# EvalGate convergence truth ledger

This ledger records the runtime facts the Skills distribution is allowed to
teach. It is intentionally short: the installed SDK's capability map, command
help, and machine-readable reports outrank memory or examples in this repo.

| Surface | Runtime truth (published SDK 3.12.5) | Skill behavior |
| --- | --- | --- |
| Capability contract | `capabilities --format json` reports contract `2026-09-10`, 22 capabilities, 66 commands, and complete coverage. | Discover capabilities before selecting a command; record SDK and contract versions in evidence. Prefer `npx @evalgate/sdk` over bare `evalgate` or `npx evalgate`. |
| Local versus hosted | `gate` and `baseline update` are deterministic/offline by default; `--allow-network` explicitly opts into provider-backed evaluators. Hosted product, repository, trace, provider, and release operations require an attributable organization-scoped credential or a saved `login` session. | Keep local evidence and hosted evidence separate. Never imply a local pass proves hosted state. |
| Authentication | The supported CLI surface is `login` (browser device flow), `whoami` (identity without printing secrets), `status --json` (readiness), `logout`, and `EVALGATE_API_KEY` for CI. The removed `auth` family returns `COMMAND_REMOVED`. The SDK library (`new AIEvalClient()`) still needs an explicit key; only the CLI reads a saved session. | Use the canonical authentication reference. Never print, commit, or request secrets in chat. Use an RFC 8628/device flow only when the published runtime advertises the exact endpoints. |
| Link outcomes | `link` may return `code: human_action_required` (legacy `GITHUB_ACCESS_REQUIRED`) when the person must open an install URL, or `GITHUB_INSTALL_UNAVAILABLE` (503) when the operator has not configured the GitHub App. | Treat the first as a human install step; treat the second as an operator problem to report, not retry. |
| Retry signals | Machine envelopes expose `retryable` and `failureClass` (for example `insufficient_scope` on a 403). Exit 4 is labelled retryable in the exit table even for some non-retryable failures. | Trust `retryable` over the exit code. |
| Gate report | Reports expose verdict, gate mode, evidence level, case/slice outcomes, and (when applicable) provider admission and release readiness. Strict envelopes use `decisionPassed`, `reportingPassed`, `evidencePassed`, `releaseReady`, and `evidenceMode`. Missing trajectory observations fail closed as `trajectory_evidence_missing` with exit `REGRESSION` (2). | Treat the machine report as authoritative. A zero process exit or score alone is not release proof. |
| Provider admission | States include `executed`, `cache_reused`, `skipped_by_policy`, `deferred_by_policy`, `provider_unavailable`, `model_retired`, `authentication_failed`, `timed_out`, `malformed_response`, `policy_blocked`, and others. Policy distinguishes `requiredNow`, `freshCacheAllowed`, `deferredAllowed`, and optional fresh calibration. | An outage is infrastructure evidence: quality is not determined; readiness is blocked or inconclusive per the report. Deferred is not PASS. Never silently substitute a provider/model. |
| Cache | SDK evaluation processes expose cache hits and trial/case cache-hit counts. A reuse is evidence only when canonical identity and freshness are eligible under active policy. | Preserve original model-call lineage and report zero new inference cost. A cache hit is not a new independent execution. Stale or policy-ineligible cache evidence cannot promote. |
| Trajectory | Release-bearing agent cases can require complete golden observations, including tool path, order, arguments, and outcomes. | Missing or truncated observations fail closed as incomplete release evidence (`trajectory_evidence_missing` / `REGRESSION`). A safe final answer cannot erase an unsafe intermediate tool action. |
| Traces | `reportTrace(client, trace, { tracePolicy: { mode } })` accepts `metadata_only`, `allowlist`, `redacted`, or `full_content_explicit_opt_in`. `/api/collector` wire fields are snake_case (`trace_id`, `span_id`, `duration_ms`); `/api/traces` accepts camelCase fields. `traceOpenAI` captures prompts/outputs unless `captureInput: false, captureOutput: false`. | Name traces without customer data; do not rely on redaction renaming. Prefer metadata-only until the operator opts in to content capture. |
| Red team | Red-team workspace/campaign/finding/report operations are cloud capabilities; the CLI exposes workspace retrieval and API operation identifiers. | Route to the hosted capability only with scoped credentials. A framework/control mapping is provenance and design guidance, not proof of implementation, compliance, certification, endorsement, or partnership. Keep attack and benign utility evidence distinct. |
| Python CLI lag | Published PyPI `evalgate-sdk` 3.6.0 lacks `capabilities`, `status`, `login`, `link`, and `repo` even when the capability map marks them `python: true`. | Until PyPI catches up, run CLI workflows with the Node `@evalgate/sdk` even in Python repositories. |
| Distribution metadata | This repository is an Agent Skills distribution, versioned independently from the SDK. The published package README may lag the runtime. | Pin the Skills distribution version in manifests and state SDK alignment separately; do not copy stale runtime prose. |

## Verification record

- Source inspected: published `@evalgate/sdk@3.12.5` capability output and CLI
  help, plus the platform's reviewed CLI/auth documentation.
- Authority order: current runtime capability/help and machine reports, then
  canonical EvalGate docs, then this ledger and other examples.
- Unknown or unsupported flags, provider controls, exit values, auth grants,
  or hosted routes must be discovered at runtime and treated as unavailable
  until verified.
- `scripts/check-commands.mjs` fails CI when this ledger's SDK or contract
  version lags npm `latest`.

The exact verified inventory is `evaluations/runtime-contract.json`. Update it
with `node scripts/check-commands.mjs --update-ledger`; SDK facts belong here,
not in versioned prose across individual skills.

## Publication and proof boundaries

- Canonical source: this repository. Website export/check must run in the website
  build at the reviewed source commit; this repository alone cannot change the
  deployed `/.well-known/agent-skills/` or `/schemas/` copies. Keep this gap open
  until deployed bytes and index digests match the generated manifest.
- Decision contract: preserve `not_a_change` / `inform`, and accept optional
  `actionKinds`. Export exactly this bundled schema to the website schema route;
  do not independently edit two enum lists. Before deployment, validate against
  the bundled source instead of assuming the served schema has synchronized.
- Live behavior: scheduled/manual CI requires real executions and fails without
  credentials. Local fixtures prove schema/scorer behavior only; no external
  model comparison was performed during this change. Record actual provider,
  model, trials, outputs, latency, and provenance before claiming skill lift.
- Client setup: Claude Code and Cursor snippets follow their linked official
  docs. Desktop uses remote connectors, with authenticated interoperability
  still requiring an actual handshake test. Manifest transport aliases name
  the same Streamable HTTP protocol in different client schemas.
- PyPI publication and third-party discovery re-indexing remain release work;
  this repository does not publish SDK packages or control index refreshes.

Import intake is conditional: npm SDK 3.12.5 does not advertise `import`,
although development runtimes may. Discover it before invoking it; no
source-tree feature is presumed published. `improve` is advertised by npm.
