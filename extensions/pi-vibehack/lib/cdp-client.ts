// Minimal Chrome DevTools Protocol client for the v1.2 browser-verifier.
//
// Design constraints:
// - No external deps. Uses node:http for /json discovery and a tiny WS client
//   built on node:net (RFC 6455 frames, client-mask).
// - Single-target, single-session. Open → command → close.
// - Operator runs `chrome --remote-debugging-port=9222` themselves; we never
//   spawn the browser.
//
// What this is NOT: a full CDP library. It implements only the methods needed
// by browser-verify: Page.navigate, Page.loadEventFired (event), Runtime.evaluate,
// Page.captureScreenshot. Anything else returns { error } untouched.

import * as http from "node:http";
import * as net from "node:net";
import * as crypto from "node:crypto";

export interface CdpTarget {
  id: string;
  type: string;
  title?: string;
  url?: string;
  webSocketDebuggerUrl?: string;
}

export async function listTargets(host = "127.0.0.1", port = 9222): Promise<CdpTarget[]> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host, port, path: "/json/list", timeout: 3000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve(JSON.parse(body));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(new Error("CDP /json/list timed out")); });
  });
}

interface PendingRpc {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
}

export class CdpSession {
  private socket: net.Socket | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRpc>();
  private eventHandlers = new Map<string, ((params: any) => void)[]>();
  private buf = Buffer.alloc(0);
  private opened = false;

  constructor(public readonly wsUrl: string) {}

  async open(timeoutMs = 5000): Promise<void> {
    const u = new URL(this.wsUrl);
    const host = u.hostname;
    const port = parseInt(u.port || "9222", 10);
    const path = u.pathname + (u.search || "");
    const key = crypto.randomBytes(16).toString("base64");
    return new Promise((resolve, reject) => {
      const sock = net.connect(port, host);
      let handshakeBuf = Buffer.alloc(0);
      const onTimeout = setTimeout(() => {
        sock.destroy(); reject(new Error(`CDP WS open timeout (${timeoutMs}ms)`));
      }, timeoutMs);
      sock.on("error", (e) => { clearTimeout(onTimeout); reject(e); });
      sock.on("connect", () => {
        const lines = [
          `GET ${path} HTTP/1.1`,
          `Host: ${host}:${port}`,
          `Upgrade: websocket`,
          `Connection: Upgrade`,
          `Sec-WebSocket-Key: ${key}`,
          `Sec-WebSocket-Version: 13`,
          ``,
          ``,
        ].join("\r\n");
        sock.write(lines);
      });
      sock.on("data", (chunk: Buffer) => {
        if (!this.opened) {
          handshakeBuf = Buffer.concat([handshakeBuf, chunk]);
          const headerEnd = handshakeBuf.indexOf("\r\n\r\n");
          if (headerEnd === -1) return;
          const header = handshakeBuf.slice(0, headerEnd).toString("utf8");
          if (!/HTTP\/1\.1 101/i.test(header)) {
            clearTimeout(onTimeout); sock.destroy();
            return reject(new Error(`CDP WS handshake failed: ${header.split("\r\n")[0]}`));
          }
          this.opened = true;
          this.socket = sock;
          const rest = handshakeBuf.slice(headerEnd + 4);
          if (rest.length > 0) this.onFrame(rest);
          clearTimeout(onTimeout); resolve();
        } else {
          this.onFrame(chunk);
        }
      });
      sock.on("close", () => { this.opened = false; this.socket = null; });
    });
  }

  private onFrame(chunk: Buffer): void {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (this.buf.length < offset + 2) return;
        len = this.buf.readUInt16BE(offset); offset += 2;
      } else if (len === 127) {
        if (this.buf.length < offset + 8) return;
        len = Number(this.buf.readBigUInt64BE(offset)); offset += 8;
      }
      let maskKey: Buffer | null = null;
      if (masked) {
        if (this.buf.length < offset + 4) return;
        maskKey = this.buf.slice(offset, offset + 4); offset += 4;
      }
      if (this.buf.length < offset + len) return;
      let payload = this.buf.slice(offset, offset + len);
      if (maskKey) {
        const out = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i++) out[i] = payload[i] ^ maskKey[i % 4];
        payload = out;
      }
      this.buf = this.buf.slice(offset + len);
      if (!fin) continue; // (we don't need fragmented support for CDP)
      if (opcode === 0x1) {
        try { this.dispatch(JSON.parse(payload.toString("utf8"))); } catch {}
      } else if (opcode === 0x8) {
        // close frame
        this.socket?.end();
      }
    }
  }

  private dispatch(msg: any): void {
    if (typeof msg.id === "number") {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? String(msg.error)));
      else p.resolve(msg.result);
    } else if (msg.method) {
      const handlers = this.eventHandlers.get(msg.method) ?? [];
      for (const h of handlers) {
        try { h(msg.params); } catch {}
      }
    }
  }

  on(method: string, handler: (params: any) => void): () => void {
    const list = this.eventHandlers.get(method) ?? [];
    list.push(handler);
    this.eventHandlers.set(method, list);
    return () => {
      const arr = this.eventHandlers.get(method);
      if (!arr) return;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    };
  }

  send(method: string, params: any = {}): Promise<any> {
    if (!this.socket) return Promise.reject(new Error("CDP not connected"));
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.writeText(payload);
    });
  }

  private writeText(text: string): void {
    if (!this.socket) return;
    const data = Buffer.from(text, "utf8");
    const mask = crypto.randomBytes(4);
    const masked = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) masked[i] = data[i] ^ mask[i % 4];
    let header: Buffer;
    if (data.length < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; header[1] = 0x80 | data.length;
    } else if (data.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81; header[1] = 0x80 | 126;
      header.writeUInt16BE(data.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81; header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(data.length), 2);
    }
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  close(): void {
    try { this.socket?.end(); } catch {}
    this.socket = null;
    this.opened = false;
  }
}
