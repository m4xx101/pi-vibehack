export function activate(pi: any): void {
  pi.register({ integration: "handoff", role: "subprocess-handoff" });
}
