# Scoped MCP authoring: verify before calling

The EvalGate product MCP supports **scoped, authenticated writes** as well as read-only review. This reference describes the first-party release catalog and is not an authorization grant. The installed server's `tools/list` and input schemas remain authoritative.

## Separate discovery from executable permission

- **Public docs MCP:** `https://www.evalgate.com/api/mcp/docs` exposes only `docs.list`, `docs.search`, and `docs.get`; no tenant context or writes.
- **Anonymous product MCP:** public protocol/schema discovery lists **released read-only schemas** without returning customer data; anonymous `tools/call` remains unauthorized.
- **Authenticated product MCP:** `https://www.evalgate.com/api/mcp` exposes an authorization-filtered tool list. The caller must have a valid organization-scoped bearer credential (or an explicitly supported authenticated session), the required scopes, and the minimum role. A server card advertising a tool does **not** mean the particular user can call it.
- **Smithery:** its registry preview can inspect anonymous public schema discovery, which does not expose write tools. The publisher must describe authenticated capabilities separately and verify the actual authenticated connection; updating registry text cannot grant privileges.

## Evaluation-authoring tools (published source capability)

| Tool | Minimum role | Required scope | Effect |
| --- | --- | --- | --- |
| `evaluations.create` | member | `eval:write` | Creates evaluation, optionally with reviewed initial cases |
| `test_cases.add` | member | `eval:write` | Attaches a case to an evaluation (locked evaluations refuse writes) |
| `runs.start` | member | `runs:write` | Starts a run, subject to spend caps, locks and readiness; **not** an immediate PASS |
| `traces.create` | member | `traces:write` | Records a trace; inspect data retention and PII before submitting |

The tool payloads are schema-dependent. Retrieve their **current** input schemas using authenticated `tools/list` before calling them. In the reviewed implementation `evaluations.create` accepts a name and optional description/type/test cases; `test_cases.add` needs a numeric `evaluationId`, name and input; `runs.start` needs an `evaluationId` with optional `environment` in `dev|staging|prod`; `traces.create` needs a name and stable `traceId`.

### Reviewed workflow

1. Read `project.inspect` or `evaluations.list` with read scopes. Choose the correct organization and verify the real task and expected result.
2. Confirm the current principal's **write** scope, member role, target tenant and explicit human approval for the specific write, including possible metered run cost. Do not acquire or print credentials in chat.
3. Discover the exact tool and schema from the *authenticated* product MCP response; do not guess a method name from prose or use the anonymous list as proof of absence.
4. For new coverage, ask approval before `evaluations.create` or `test_cases.add`; never invent a passing expected output. A tool result that records an evaluation ID is not evaluation success.
5. Ask approval before `runs.start`. Follow the returned run identifier with `runs.list` or `run.explain`; report running, blocked, failed and incomplete outcomes truthfully.
6. For `traces.create`, use metadata-only or redacted evidence until content capture is explicitly approved. Do not send unreviewed customer prompts, secrets or cross-tenant artifacts.
7. Preserve tool name, response status, resulting resource IDs, observation window, requested scope and missing evidence. A 401/403/429 or unsupported-tool response is a refusal, not an invitation to downgrade the guard.
8. A successful MCP write **never** authorizes baseline acceptance, model promotion, policy changes, repository push, pull-request merge, checkout, or billing. Those remain separate permissions and approval surfaces.

## Connection-management permissions

Read operations such as `connections.list`, `connections.catalog`, and `connections.graph` require the scopes advertised by the current release catalog. `connections.create_root`, `connections.backfill`, `connections.repair_root`, `connections.set_root_state`, and `connections.select_resources` are **admin-only** writes, with `admin:workspace`; selected repair/state/selection operations additionally require `resources:read` and `resources:write`. They may affect saved connectors and require explicit administrative intent. Do **not** use these to bootstrap the first eval for an ordinary member.

## Explicitly not released as product MCP

Portable Quality operations (for example `quality.check.submit`, `quality.context.create`, `quality.grant.create`, uploads, feedback, and standards approval) are not publicly qualified in the reviewed catalog. The product MCP does not support an unrestricted, fully autonomous release or payment workflow. Do not rename a different tool to approximate an unreleased operation.

## Authentication and remote clients

The product endpoint advertises protected-resource and authorization-server metadata and accepts organization-scoped access tokens. Whether Smithery, Claude Desktop or a particular remote client's OAuth onboarding completes successfully must be proven through a real handshake and a least-privilege, test-workspace write/readback. Claude Code / Cursor examples may use **environment-backed** authorization headers; never check a literal token into `.mcp.json`, a public Skill, or a Smithery description.

The MCP write adapters replay the caller's already validated authority into existing REST routes, preserving their business guards. An OAuth grant, source registration, or a Smithery listing by itself is **not** end-to-end evidence that a write succeeds.

References: [First-party MCP server card](https://www.evalgate.com/.well-known/mcp/server-card.json), [feature-status inventory](https://www.evalgate.com/docs/platform/feature-status), [MCP integration guide](https://www.evalgate.com/docs/platform/mcp-integration), [Smithery listing](https://smithery.ai/servers/evalgate/evalgate).
