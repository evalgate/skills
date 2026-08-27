---
name: use-evalgate-mcp
description: Use EvalGate’s public documentation MCP or authenticated read-only product MCP. Use when a client needs product guidance or organization-scoped project, evaluation, run, baseline, or connector context; do not claim anonymous product access or MCP mutations.
---

# Use EvalGate MCP

## When to use

Reach for this skill when an MCP-capable agent needs EvalGate guidance or attributable customer context. The documentation server is a public read-only feed over reviewed published docs. Obtain and configure a scoped API key before using product tools or customer data.

## Inputs

- No credential for the public documentation server.
- A customer-provisioned short-lived bearer token or API key for the product server.
- MCP client support for Streamable HTTP.
- The required product read scopes (`eval:read` for the product server; connector health has an organization-admin boundary).

## Safe workflow

1. Configure the public documentation server at `https://www.evalgate.com/api/mcp/docs` without a credential. Configure the product server at `https://www.evalgate.com/api/mcp` with its token in the client’s secret store, never a checked-in header.
2. Use protocol discovery or the client’s MCP handshake, then call product tools only when visible for the token’s scopes.
3. Product tools are read-only: `project.inspect`, `project.plan`, `evaluations.list`, `runs.list`, `run.explain`, `baseline.lineage`, `docs.search`, and `connector.health`.
4. Use the docs server for reference retrieval and cite the returned document identifiers. Use the product server for organization-scoped state and evidence.
5. Treat `project.plan` as advisory. Use the CLI or web control plane for approved mutations; this plugin does not authorize baseline changes, run starts, credential changes, or pull-request comments.

When MCP evidence informs an AI-change decision, use the primary
[evaluate-ai-change](../evaluate-ai-change/SKILL.md) workflow and its
[canonical decision contract](../evaluate-ai-change/references/decision-contract.md).
MCP tools supply read-only evidence; they do not create a second classification
enum, derive a release decision, or authorize the resulting action.

## Expected artifacts

Return the server used, tool name, request status, and evidence/document identifiers. Include organization context only for authenticated product results. Redact bearer tokens, raw customer payloads, and connector secrets from summaries.

## Safety boundary

Every product call must be attributable to an API key and bounded by its organization and scopes. The anonymous docs server must remain limited to its bundled public catalog. Do not bypass product authentication, embed a token in `mcp.json`, infer write access from a read response, or treat a failed connection as proof that data is absent.

## Validation

Confirm the client negotiated the advertised MCP transport. For product calls, verify the token scope and organization boundary; for docs calls, verify results come only from the published catalog. Confirm no mutation tool was exposed. If a server is unreachable, report the endpoint and its actual authentication prerequisite rather than switching to an undocumented route.
