# Smithery publisher handoff — EvalGate MCP (2026-10-14)

## What changed and what did not

The current first-party product MCP card advertises authenticated reads and scoped evaluation writes. Smithery's public listing still describes the **older read-only** service. This repository owns the public Agent Skills and client configuration, but is **not** the publisher account or a way to mutate the third-party Smithery listing.

The correct listing is `evalgate/evalgate`, which should continue pointing to `https://www.evalgate.com/api/mcp`. Keep the distinct anonymous **docs** MCP at `https://www.evalgate.com/api/mcp/docs`. Do not create a competing duplicate listing.

### Proposed listing copy (publisher review)

**Title:** EvalGate — AI evaluation, regression gates and MCP authoring

**Short description:** Inspect evaluation evidence and, with an authorized organization-scoped connection, create evaluations, add test cases, start runs and record traces. Public documentation and read-only discovery need no customer data; mutations require scoped credentials and permissions.

**First result:** Connect the public documentation MCP with no signup to inspect EvalGate's official instructions, or run the local, credential-free `npx @evalgate/sdk init --local` preview. An actual MCP write needs an authorized EvalGate organization and a supporting client authentication flow.

**Write tools:** `evaluations.create`, `test_cases.add`, `runs.start`, `traces.create` for an authorized member; connection-management mutations require admin role and additional scopes. **No anonymous writes.**

**Limitations:** Portable Quality upload, check submission, background grants, standards acceptance and broad autonomous promotion are not qualified for product MCP. The Smithery scan may only see the anonymous read schema.

**Links:** https://www.evalgate.com/developers · https://www.evalgate.com/.well-known/mcp/server-card.json · https://github.com/evalgate/skills

## Publisher steps

1. Verify the production MCP card and read-only docs card at their first-party URLs; confirm advertised tools, scopes and public origin.
2. In the publisher's **own Smithery account**, edit/re-publish the existing `evalgate/evalgate` entry and refresh its scan. The current Smithery CLI documents `smithery auth login` then `smithery mcp publish https://www.evalgate.com/api/mcp -n evalgate/evalgate`; confirm command help/version before invoking, and avoid creating a second slug.
3. If the scanner only sees anonymous `tools/list`, explain in the listing that further tools are exposed *after authentication*. Do not expose dummy anonymous writes or send a production admin key merely to inflate the preview.
4. Using an isolated test workspace and a **least-privilege eval:write** token, complete the actual provider-mediated connect + authorized `tools/list` + `evaluations.create` + readback. Separately verify `runs.start` only after explicit cost/side-effect approval.
5. Record the user-facing install flow, client version, the exact discovered tool names, refusals at insufficient scope and revoked tokens, and whether Smithery forwards the token correctly. If OAuth onboarding fails, fix the authorization flow before promising one-click writes.
6. Recheck indexing after the refresh. Smithery UI copy alone does not prove authenticated client compatibility.

## Publish gating

- Anonymous schema discovery remains read-only.
- No credentials committed in this repository, skill manifests or demos.
- No admin or customer data operations in automated marketplace scans.
- The same tenant/role/scope and business guards must apply over direct MCP and the Smithery-mediated route.
- Only mark the Smithery **write path verified** after a real authenticated creation and subsequent persisted readback.

Source of authority: `contracts/mcp-release-capabilities.json` in EvalGate's platform repository, emitted server card, and runtime-authenticated tool list.
