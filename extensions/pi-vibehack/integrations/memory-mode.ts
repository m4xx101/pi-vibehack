export function activate(pi: any): void {
  pi.register({ integration: "memory-mode", role: "pin-defer" });
}
