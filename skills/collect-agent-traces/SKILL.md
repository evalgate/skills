---
name: collect-agent-traces
description: Add bounded EvalGate tracing to an agent or model integration and verify the resulting evidence. Use when a team needs latency, tool, or outcome visibility; do not use this to capture secrets or unrestricted production payloads.
---

# Collect bounded agent traces

## CLI invocation

Every `evalgate` command in this skill means `npx @evalgate/sdk`. Never run
`npx evalgate` — the unscoped npm package is a third-party package. Discover installed Python CLI capabilities first; use the Node CLI when a
requested command is absent, even in Python repositories.

## When to use

Use this when an agent workflow needs inspectable traces for evaluation, debugging, or release evidence. Prefer the SDK’s supported integration boundary over custom database writes or hidden collectors.

## Inputs

- Runtime and package manager (TypeScript or Python).
- The workflow entry point and fields that are safe to record.
- Optional least-privilege API key with `traces:write`; keep it in a secret
  manager or `EVALGATE_API_KEY`. A saved `login` session works for CLI `trace`;
  the SDK library (`new AIEvalClient()`) still needs an explicit key.

## Safe workflow

1. Check local readiness first with `npx @evalgate/sdk doctor --quick`.
2. Install the documented SDK package. Prefer `npm install @evalgate/sdk` for
   CLI and TypeScript. `pip install evalgate-sdk` is fine for in-process Python
   tracing APIs. Discover Python command help before using its CLI; run commands
   it does not advertise through the Node SDK. Use the public
   tracer APIs at `https://evalgate.com/docs/sdk/typescript` or
   `https://evalgate.com/docs/sdk/python`.
3. Define an explicit redaction policy before enabling hosted collection.
   `reportTrace(client, trace, { tracePolicy: { mode } })` accepts
   `metadata_only`, `allowlist`, `redacted`, or
   `full_content_explicit_opt_in`. All four upload correctly. Prefer
   `metadata_only` or `allowlist` unless the operator opted into content
   capture. Record stable IDs, timing, model/provider metadata, tool names, and
   outcome summaries; omit credentials, authorization headers, raw customer
   content, and unnecessary prompts.
4. Name traces so they carry no customer data. `metadata_only` and `allowlist`
   rename every trace to `"redacted"`, so do not rely on the uploaded name to
   preserve meaning.
5. For `/api/collector` (used by `reportTrace`), use snake_case wire fields
   (`trace_id`, `span_id`, `duration_ms`). `/api/traces` is a different endpoint
   accepting camelCase fields such as `traceId` and `durationMs`. Follow the
   selected endpoint schema; do not apply the collector casing rule universally.
6. Configure the collector with `EVALGATE_API_KEY` (or a saved CLI login for
   CLI-only work) and the documented organization context. Do not paste a key
   into source, logs, issue comments, or generated skill artifacts.
7. When wrapping OpenAI with `traceOpenAI`, pass
   `captureInput: false, captureOutput: false` unless the operator explicitly
   opted into prompt/output capture — the defaults send full content.
8. Send a small representative sample, inspect the returned trace IDs, and
   verify that failure details are redacted before enabling broader collection.
9. Use the local gate for release blocking. Hosted traces are evidence and
   shared history; they do not replace the repository’s reviewed baseline.

## Expected artifacts

Provide the integration diff, redaction policy (including `tracePolicy.mode`),
a sample trace ID or local evidence file, and the verification result. Do not
include raw trace payloads in public reports.

## Safety boundary

Never enable an always-on daemon, collect an entire production database, or use a broad admin key for tracing. If the required write scope or retention policy is unclear, stop and ask the operator.

## Validation

Run the application’s existing tests, confirm a trace can be created and is attributable to the intended organization, and check that redaction remains effective in both success and error paths.
