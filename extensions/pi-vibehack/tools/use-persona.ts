// vibehack_use_persona — let the Planner self-switch domain personas mid-engagement.
//
// CyberStrike pattern: Tab cycles between specialist agents (web-application,
// mobile, cloud, network + 8 vuln-class testers). Each carries domain
// methodology that biases tool selection. We mirror this without sub-agent
// spawning: persona is per-engagement state and prepended to the system prompt
// at before-agent-start.
//
// Use case in the loop: the Planner expands a generic web target, discovers a
// JWT in storage, calls vibehack_use_persona("auth-bypass") to bias toward
// JWT-confusion / SAML-replay tests, then continues.

import { Type } from "@sinclair/typebox";
import { activeEngagementId } from "../lib/engagement.ts";
import { setActivePersona, PERSONAS } from "../lib/persona-registry.ts";
import { appendEvent, nowIso } from "../lib/events.ts";
import { engagementDir } from "../lib/engagement.ts";
import { normalizeArgs, safePrepare } from "../lib/prepare-args.ts";

const PERSONA_NAMES = Object.keys(PERSONAS) as [string, ...string[]];

export const usePersonaSchema = Type.Object({
  name: Type.Union(PERSONA_NAMES.map((n) => Type.Literal(n))),
  rationale: Type.Optional(Type.String()),
}, { additionalProperties: false });

export const usePersonaTool = {
  name: "vibehack_use_persona",
  label: "Switch active specialist persona",
  description:
    `Switch the active persona for the current engagement. ` +
    `Available: ${PERSONA_NAMES.join(", ")}. ` +
    `Persona body is prepended to the system prompt on the next turn.`,
  parameters: usePersonaSchema,

  prepareArguments: safePrepare((args: unknown) =>
    normalizeArgs(args, { persona: "name", reason: "rationale", why: "rationale" }),
  ) as any,

  async execute(
    _callId: string,
    params: { name: string; rationale?: string },
  ): Promise<any> {
    const eng = await activeEngagementId();
    if (!eng) return { error: "no active engagement" };
    if (!PERSONAS[params.name]) return { error: `unknown persona: ${params.name}` };
    await setActivePersona(eng, params.name);
    try {
      await appendEvent(engagementDir(eng), {
        ts: nowIso(),
        engagement_id: eng,
        event: "persona_switch",
        metadata: { name: params.name, rationale: params.rationale ?? "" },
      } as any);
    } catch {}
    return {
      active_persona: params.name,
      label: PERSONAS[params.name].label,
      domain: PERSONAS[params.name].domain,
    };
  },
};
