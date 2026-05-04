// register-providers: at session_start, read config.yaml `providers` section and
// call pi.registerProvider() once per configured provider. Resolves apiKey from
// the env var named in `apiKey` (e.g. apiKey: "LOCAL_API_KEY" -> reads $LOCAL_API_KEY).
// Best-effort — failures per provider are logged and swallowed so one bad entry
// doesn't break the rest.

// Note: pi parameter is intentionally untyped here. The current single-arg
// registerProvider({ name, ... }) call shape predates pi-mono's typed
// registerProvider(name, cfg) signature and is contracted by the test
// suite. Migrating to the typed shape is out of Phase 1 scope.

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  api?: string;
  models?: Array<{ id: string; name?: string; contextWindow?: number; maxTokens?: number; cost?: object }>;
}

export interface VibehackConfig {
  providers?: Record<string, ProviderConfig>;
}

export function registerProvidersFromConfig(pi: any, cfg: VibehackConfig): void {
  const providers = cfg.providers || {};
  for (const [name, p] of Object.entries(providers)) {
    try {
      const apiKey = process.env[p.apiKey] ?? "";
      pi.registerProvider({
        name,
        baseUrl: p.baseUrl,
        apiKey,
        api: p.api ?? "openai-completions",
        models: p.models ?? [],
      });
    } catch (e) {
      console.warn(`[pi-vibehack] provider '${name}' registration failed:`, (e as Error).message);
    }
  }
}
