// Re-exports of pi-mono extension API types so call sites in pi-vibehack
// don't litter deep imports throughout. Import from this module instead of
// `@mariozechner/pi-coding-agent` directly — that way if pi-mono renames
// or restructures, we only update one file.
//
// Phase 1 of the v1.2 rewire plan (extensions/pi-vibehack/lib/typed-pi.ts).

export type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  ExtensionFactory,
  ExtensionHandler,
  ExtensionEvent,
  ExtensionUIContext,
  ExtensionUIDialogOptions,

  // Event payloads we hook on
  SessionStartEvent,
  SessionShutdownEvent,
  SessionBeforeCompactEvent,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  BeforeProviderRequestEvent,
  BeforeProviderRequestEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  ContextEvent,
  AgentStartEvent,
  AgentEndEvent,
  TurnStartEvent,
  TurnEndEvent,

  // Tool def shapes
  ToolDefinition,
  RegisteredTool,
  ToolExecutionMode,
} from "@mariozechner/pi-coding-agent";
