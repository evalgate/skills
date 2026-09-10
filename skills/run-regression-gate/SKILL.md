---
name: run-regression-gate
description: Run and interpret an EvalGate regression gate before a release or pull request. Use when evaluation files and a reviewed baseline already exist; do not use this to silently update the baseline or weaken thresholds.
---

# Run a regression gate

## When to use

Reach for this skill before shipping a change to an AI behavior, prompt, tool policy, or evaluation harness. It is for comparing current evidence with a reviewed baseline, not for replacing a failing result with a new baseline.

## Inputs

- Repository root containing `evalgate.config.json` and a reviewed baseline.
- The change or commit being evaluated.
- Optional base ref for a pull-request comparison.

## Discover the installed contract first

Do not infer the command catalog or failure semantics from memory. Start with
the installed SDK's machine-readable capability map and help:

```bash
npx @evalgate/sdk capabilities --format json
npx @evalgate/sdk capabilities evaluate --format json
npx @evalgate/sdk capabilities release --format json
npx @evalgate/sdk gate --help
npx @evalgate/sdk check --help
npx @evalgate/sdk ci --help
npx @evalgate/sdk trace --help
```

Use the returned capability boundary, available command, and artifact names as
the authority for this installation. The `evaluate` capability covers local
execution and gating; the `release` capability covers synchronization, CI, and
promoted-evidence verification. Hosted commands require the documented,
organization-scoped credential. Never print or commit it.

## Safe workflow

1. Discover the intended suite and write its machine-readable manifest with `npx @evalgate/sdk discover --manifest` (or `evalgate discover --manifest`).
2. Run the local, deterministic gate with `npx @evalgate/sdk gate --format json`. It is offline by default; use `--allow-network` only when the evaluated project explicitly needs provider-backed execution. For CI, inspect `ci --help`, then use the supported `evalgate ci --format github --write-results` form and upload only the documented artifacts.
3. When the release decision is API-backed, run the supported `evalgate check --format json` command with its required evaluation and credential arguments. Treat the command's machine report as the decision record, not a remembered numeric exit-code table.
4. For a failure, run `npx @evalgate/sdk explain --format json` and inspect the evidence-linked case or failure mode before changing code.
5. If behavior intentionally changed, stop and ask for explicit baseline review. Only then run `npx @evalgate/sdk baseline update`; never run it automatically as failure recovery.

## Interpret evidence before scoring

The process has separate decisions. Read the JSON report (and, for an API
check, `.evalgate/last-report.json`) for all of these before calling a release
ready:

- evaluator verdict and threshold/regression deltas;
- eligible case count and protected-slice outcomes;
- evidence mode: `offline`, `network`, `mixed`, or `cache_only` when present;
- provider admission and `releaseReadiness` when provider evidence is present;
- strict report flags such as `decisionPassed`, `reportingPassed`,
  `evidencePassed`, and `releaseReady` when present.

`releaseReady` is the release conclusion. Do not infer it from a passing score,
`decisionPassed`, or a zero process exit alone. A strict report is not complete
evidence when the gate was not applied or the eligible count is zero.

If JSON output is malformed, missing required fields, or cannot be tied to the
evaluated revision, do not fall back to human text or an optimistic exit-code
interpretation. Mark the execution as invalid/infrastructure failure, preserve
the raw-safe diagnostic, and leave release readiness inconclusive.

### Provider and cache semantics

Provider execution is infrastructure evidence, not an evaluator verdict. The
Provider states distinguish quality-producing `executed` and
`cache_reused` from `provider_unavailable`, `deferred_by_policy`,
`rate_limited`, `model_retired`, `authentication_failed`, `timed_out`,
`malformed_response`, `policy_blocked`, and `cancelled` states.

- A provider outage (`provider_unavailable`) means quality is **not determined**. Preserve the provider
  state as infrastructure evidence and use the report's `releaseReadiness`:
  policy may make it `blocked` or `inconclusive`; never relabel it as a product
  regression or silently pass an older score.
- Apply the admission policy fields `requiredNow`/`required_now`,
  `freshCacheAllowed`/`fresh_cache_allowed`, and
  `deferredAllowed`/`deferred_allowed` (plus
  `requireFreshCalibration` when present) to the release decision. A required
  provider with no eligible fresh evidence cannot be promoted; an explicitly
  deferred obligation remains recorded and unresolved.
- If `requireFreshCalibration` is enabled, a `stale` or
  `not_comparable` calibration is missing admissible provider evidence and
  leaves readiness blocked or inconclusive.
- A cache hit satisfies provider evidence only when it is an exact, eligible
  fresh hit and the active policy allows cache reuse. An unspecified or stale
  cache result is not fresh evidence.
- When the report exposes cache lineage, retain the original execution/model
  identity and the fact that new inference cost was zero. Do not treat a cache
  hit as a new provider execution.
- Do not silently substitute a provider or model. If an explicit fallback is
  part of policy, inspect the recorded routed/returned identity and report the
  resulting evidence scope honestly.

For a judge request, audit the runtime sequence end to end: canonical request
identity, authorized cache lookup, eligibility/freshness decision, then either
`cache_reused` with original lineage and `$0` new inference or Model Gateway
execution followed by the provider/model cost ledger and cache write. If the
report cannot prove one of those branches, call the result incomplete and keep
release readiness inconclusive; a cache contract alone is not an operational
cache.

### Network semantics

`gate` is the local deterministic path. Network/provider work is an explicit
choice, not an implicit requirement of a local gate. A network failure or an
unavailable provider must remain distinguishable from a failed test assertion.
If a release policy requires current provider evidence, an unavailable or
missing provider observation blocks or makes the decision inconclusive as the
machine report states. An `unknown` provider state or unknown non-zero process
status is infrastructure/inconclusive until the machine report explains it;
never treat an unknown value as PASS.

### Release-bearing trajectory evidence

The local `gate` is release-bearing for active golden trajectory assertions.
Every active case with a trajectory assertion needs a matching observation in
`.evalgate/golden/observations.jsonl`. A missing observations file or missing
case fails closed as trajectory evidence missing. Final-answer equality alone
does not pass a case when the tool path, order, arguments, or other trajectory
assertion regresses. Lower-level trajectory helpers may be omission-compatible
for explicitly non-release callers; do not use that mode as release evidence.

## Expected artifacts

Produce the machine-readable gate/check report, process status, evaluated
commit or working-tree identity, and a concise next action. Depending on the
capability selected, this may include `.evalgate/last-run.json`,
`.evalgate/last-report.json`, `evals/regression-report.json`,
`.evalgate/runs/latest.json`, and golden trajectory files. In CI, retain the
generated results without including credentials, raw customer data, or
unredacted prompts.

## Safety boundary

Do not lower thresholds, delete failing cases, retry until green, mutate release configuration, or upload failed context to the hosted platform without an explicit operator choice. Probabilistic checks need the configured repetition and pass-rate evidence; one lucky retry is not a pass.

## Validation

Verify the command used the intended repository root and reviewed baseline,
the report contains case- and slice-level outcomes, the eligible count is
non-zero, and a non-success process status is surfaced to CI. For API checks,
validate the strict report fields and require `releaseReady: true` before
promoting. For provider-backed runs, verify provider state, cache freshness,
and release readiness independently of the score. For release-bearing
trajectory assertions, verify observations exist for every active case. A
passing command with zero discovered cases, missing observations, stale cache,
or unavailable provider evidence is not sufficient evidence.
