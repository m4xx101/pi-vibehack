import { describe, it, expect, vi, afterEach } from "vitest";
import { registerProvidersFromConfig } from "../extensions/pi-vibehack/hooks/register-providers.js";

describe("registerProvidersFromConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls pi.registerProvider once per configured provider", () => {
    const cfg = {
      providers: {
        "local-lmstudio": {
          baseUrl: "http://localhost:1234/v1",
          apiKey: "LOCAL_API_KEY",
          api: "openai-completions",
          models: [{ id: "qwen-72b", name: "Qwen", contextWindow: 32768, maxTokens: 4096 }],
        },
      },
    };
    vi.stubEnv("LOCAL_API_KEY", "sk-local");
    const fakePi = { registerProvider: vi.fn() };
    registerProvidersFromConfig(fakePi, cfg);
    expect(fakePi.registerProvider).toHaveBeenCalledOnce();
    const arg = fakePi.registerProvider.mock.calls[0][0];
    expect(arg.baseUrl).toBe("http://localhost:1234/v1");
    expect(arg.apiKey).toBe("sk-local");
  });

  it("no-ops on missing providers section", () => {
    const fakePi = { registerProvider: vi.fn() };
    registerProvidersFromConfig(fakePi, {});
    expect(fakePi.registerProvider).not.toHaveBeenCalled();
  });

  it("try/catches errors per provider; one failure doesn't abort the rest", () => {
    const cfg = {
      providers: {
        bad: { baseUrl: "x", apiKey: "MISSING_ENV" },
        good: { baseUrl: "y", apiKey: "GOOD_ENV", models: [] },
      },
    };
    vi.stubEnv("GOOD_ENV", "ok");
    const fakePi = {
      registerProvider: vi.fn((arg: any) => { if (!arg.apiKey) throw new Error("bad"); }),
    };
    registerProvidersFromConfig(fakePi, cfg);
    expect(fakePi.registerProvider).toHaveBeenCalledTimes(2);
  });
});
