import { Type, type Static } from "@sinclair/typebox";

export const OperatorOutputSchema = Type.Object(
  {
    node_id: Type.String(),
    outcome: Type.Union([
      Type.Literal("confirmed"),
      Type.Literal("falsified"),
      Type.Literal("inconclusive"),
      Type.Literal("blocked-on-auth"),
    ]),
    evidence: Type.Array(
      Type.Object(
        {
          kind: Type.String(),
          ref: Type.String(),
          summary: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
    confidence: Type.Number({ minimum: 0, maximum: 1 }),
    suggested_next_steps: Type.Array(
      Type.Object(
        {
          claim: Type.String(),
          next_test: Type.String(),
          falsifier: Type.String(),
        },
        { additionalProperties: false },
      ),
    ),
    handoff_summary: Type.String(),
    auth_state_changes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    scurl_template_request: Type.Optional(
      Type.Union([
        Type.Null(),
        Type.Object(
          {
            template: Type.String(),
            field_needed: Type.String(),
            from_url: Type.Optional(Type.String()),
          },
          { additionalProperties: false },
        ),
      ]),
    ),
    cost_tokens: Type.Number({ minimum: 0 }),
    cost_usd: Type.Number({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export type OperatorOutput = Static<typeof OperatorOutputSchema>;
