export function activate(pi: any): void {
  pi.register({ integration: "pi-mcp-adapter", role: "mcp-proxy" });
}
