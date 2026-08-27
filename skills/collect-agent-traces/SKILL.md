---
name: collect-agent-traces
description: Add bounded EvalGate tracing to an agent or model integration and verify the resulting evidence. Use when a team needs latency, tool, or outcome visibility; do not use this to capture secrets or unrestricted production payloads.
---

# Collect bounded agent traces

## When to use

Use this when an agent workflow needs inspectable traces for evaluation, debugging, or release evidence. Prefer the SDK’s supported integration boundary over custom database writes or hidden collectors.

## Inputs

- Runtime and package manager (TypeScript or Python).
- The workflow entry point and fields that are safe to record.
- Optional least-privilege API key with `traces:write`; keep it in a secret manager or `EVALGATE_API_KEY`.

## Safe workflow

1. Check local readiness first with `npx @evalgate/sdk doctor --quick` or `evalgate doctor --quick`.
2. Install the documented SDK package (`npm install @evalgate/sdk` or `pip install evalgate-sdk`) and use the public tracer APIs described at `https://evalgate.com/docs/sdk/typescript` or `https://evalgate.com/docs/sdk/python`.
3. Define an explicit redaction policy before enabling hosted collection. Record stable IDs, timing, model/provider metadata, tool names, and outcome summaries; omit credentials, authorization headers, raw customer content, and unnecessary prompts.
4. Configure the collector with `EVALGATE_API_KEY` and the documented organization context. Do not paste a key into source, logs, issue comments, or generated skill artifacts.
5. Send a small representative sample, inspect the returned trace IDs, and verify that failure details are redacted before enabling broader collection.
6. Use the local gate for release blocking. Hosted traces are evidence and shared history; they do not replace the repository’s reviewed baseline.

## Expected artifacts

Provide the integration diff, redaction policy, a sample trace ID or local evidence file, and the verification result. Do not include raw trace payloads in public reports.

## Safety boundary

Never enable an always-on daemon, collect an entire production database, or use a broad admin key for tracing. If the required write scope or retention policy is unclear, stop and ask the operator.

## Validation

Run the application’s existing tests, confirm a trace can be created and is attributable to the intended organization, and check that redaction remains effective in both success and error paths.
