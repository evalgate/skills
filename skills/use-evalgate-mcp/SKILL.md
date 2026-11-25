---
name: use-evalgate-mcp
description: Discover EvalGate's public documentation MCP and scoped product MCP read/write tools. Use for authenticated evaluation, run, trace or connector evidence and approved authoring; enforce the caller's real scopes and never claim anonymous writes.
---

# Use EvalGate MCP

## When to use

Reach for this skill when an MCP-capable agent needs public EvalGate documentation, authenticated customer evidence, or an approved evaluation write. The documentation server is always public and read-only. The product server exposes read tools and conditional write tools after successful organization authentication; the caller's role and scopes determine the available operations.

`npx skills add evalgate/skills` copies skills only — it does **not** install
`.mcp.json`. Add the servers below to the client configuration yourself.

## Inputs

- No credential for the public documentation server.
- A customer-provisioned short-lived bearer token or API key for the product server.
- MCP client support for Streamable HTTP.
- Explicit user approval for any write, especially a metered evaluation run or a trace containing customer data.
- A least-privilege permission appropriate to the actual operation: `eval:read`/`runs:read` for read tasks, `eval:write` for evaluation and case creation, `runs:write` for run starts, `traces:write` for trace creation; connection mutations additionally require an admin role and `admin:workspace`.

## Configure the servers

- Documentation server: `https://www.evalgate.com/api/mcp/docs`, anonymous and
  read-only.
- Product server: `https://www.evalgate.com/api/mcp`, with
  `Authorization: Bearer ${EVALGATE_API_KEY}` expanded from the environment or
  the client's secret store. Anonymous calls return `401`.

Each client uses a different file and variable syntax. Read
[client configuration](references/client-configuration.md) for the exact
Claude Code, Cursor or Claude Desktop format before editing any config. Never
commit a literal token, and never paste one client's file into another.

## Smithery and discovery

The official [EvalGate Smithery listing](https://smithery.ai/servers/evalgate/evalgate)
may lag the actual published MCP. The first-party
[product server card](https://www.evalgate.com/.well-known/mcp/server-card.json)
advertises released read and write tools. An **anonymous** `tools/list` shows
only released read-only schemas; authenticated `tools/list` is role/scope
filtered. A registry crawler seeing read tools only is not proof that an
authorized user cannot write. A Smithery listing, however, cannot mint an
EvalGate credential or widen scope. See [publisher handoff](https://github.com/evalgate/skills/blob/main/docs/SMITHERY_HANDOFF.md)
for the metadata refresh and real write/readback acceptance steps.

## Safe workflow

1. Configure the anonymous docs MCP, then the product MCP if a signed-in
   organization context is needed. Keep credentials in the client's secret
   store, not this repo or a committed configuration file.
2. Negotiate the actual MCP transport, then call `tools/list` for the
   **current authenticated caller** before selecting product actions. The
   public list exposes only read schemas. Missing scopes, insufficient role,
   401/403 refusals, or an unsupported client remain explicit blockers.
3. For read tasks, use `project.inspect`, `project.plan`,
   `evaluations.list`, `runs.list`, `run.explain`,
   `baseline.lineage`, `docs.search`, `connector.health`, and
   authorized connection read tools. The run/connector tools have their own
   scope and role requirements; do not infer that `eval:read` unlocks all.
4. For **approved authoring** and a credential with the right scope and at
   least member role, the released product catalog includes
   `evaluations.create`, `test_cases.add`, `runs.start`, and
   `traces.create`. Use their discovered schemas, obtain approval before
   side effects, and confirm actual result/resource IDs. A run start is not a
   passing run. See [scoped authoring](references/scoped-authoring.md).
5. Connection writes (including `connections.create_root`,
   `connections.repair_root`, `connections.set_root_state`,
   `connections.select_resources`, and `connections.backfill`) require
   an administrator and declared additional scopes. Do not use them as an
   ordinary-member onboarding workaround.
6. `project.plan` stays advisory. MCP authoring does **not** accept a baseline,
   promote a model, merge a pull request, authorize billing, or change policy.
   Portable Quality operations such as `quality.check.submit`, resource
   upload, standard acceptance and background grants are not publicly
   qualified for this product MCP. Do not call a similarly named tool.
7. When an MCP result informs a release decision, route through
   [evaluate-ai-change](https://github.com/evalgate/skills/blob/main/skills/evaluate-ai-change/SKILL.md)
   and its [canonical decision contract](references/decision-contract.md).
   MCP returns evidence or effects, **not** a second release-decision enum.

## Evidence of actual execution

Record server/transport, authenticated principal role (never credential),
selected organization, exact tool, result/status, resource identifiers and
subsequent readback or run-state observation. For a write, distinguish
`accepted`, `persisted`, `executing`, `completed`, `blocked` and
`inconclusive`; a schema list or HTTP receipt is not a completed evaluation.
Do not expose secrets, raw PII or cross-tenant details.

## Expected artifacts

Return the server used, exact tool name, request status, and evidence/document identifiers. For writes include the approved effect and persisted resource/readback (when available), never a fabricated gate result. Include organization context only for authenticated product results. Redact bearer tokens, raw customer payloads, and connector secrets.

## Safety boundary

Every product operation must be attributable to a validated organization principal and bounded by role, scope, quota and the actual tool schema. The anonymous docs server remains public-content-only. Never bypass authentication or CSRF, embed a key in `mcp.json`, infer write access from a read response, or treat an authentication failure as proof customer data is absent. A Skill does not grant write authority.

## Validation

Confirm the client negotiated the advertised MCP transport. For product calls verify the token, scopes, role and tenant boundary; for docs calls verify results come only from the public catalog. Confirm anonymous callers cannot execute writes, read-only users cannot discover writes, and authorized test-workspace writes persist only after approval. If the server is unreachable, report the endpoint and auth prerequisite rather than switching to an undocumented route.

## Recovery

For `401`, `403`, missing tools or a write without readback, follow the hosted
MCP rows in [failure recovery](references/failure-recovery.md). Never call a
similarly named tool to work around a missing one. If the server contradicts
this skill, draft a report with
[report-evalgate-friction](https://github.com/evalgate/skills/blob/main/skills/report-evalgate-friction/SKILL.md).
