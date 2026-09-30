# Provider and cache semantics

Shared release-evidence rules for provider execution and cache reuse. Use these rules for AI-change evaluation and regression gating.

## Evidence modes

Classify the evidence mode separately from the product verdict:

- `offline`: deterministic local checks only;
- `network`: a provider-backed execution actually ran;
- `mixed`: both kinds of evidence are present;
- `cache_only`: an eligible cached observation was reused without new model
  inference.

## Provider states

Provider execution is infrastructure evidence, not an evaluator verdict. The
provider vocabulary distinguishes quality-producing `executed` and
`cache_reused` from `deferred_by_policy`, `provider_unavailable`,
`model_retired`, `authentication_failed`, `timed_out`, `malformed_response`,
`policy_blocked`, `rate_limited`, `cancelled`, and other states.

For every provider-backed result, preserve the requested and effective
provider/model identity, execution state, calibration state, cache lineage,
case and slice counts, and any request or run IDs. Apply the report's
`requiredNow`/`required_now`, `freshCacheAllowed`/`fresh_cache_allowed`,
`deferredAllowed`/`deferred_allowed`, and (when present)
`requireFreshCalibration` rather than guessing:

- an unavailable provider means quality is **not determined** and readiness is
  blocked or inconclusive, not a product regression and not a pass;
- a deferred obligation remains unresolved and is not PASS;
- when fresh calibration is required, `stale` or `not_comparable` calibration
  cannot establish current provider trust;
- a cache hit is usable only when canonical identity and freshness are eligible
  under the active policy. Retain original execution/model lineage and report
  zero new inference cost; never call it an independent trial;
- a fallback provider/model is valid only when explicitly authorized and fully
  recorded. Never silently substitute one.

## Judge and cache operational path

For a judge request, verify the operational path in the evidence rather than
accepting a cache design claim: canonical request identity → authorized cache
lookup → eligible fresh hit (reuse original lineage, record `cache_reused`, and
incur `$0` new inference) **or** Model Gateway execution → provider/model call
and cost ledger → cache write. A missing identity, authorization, freshness,
lineage, cost, or write receipt leaves the run incomplete and therefore
inconclusive; it is not proof that the cache is operational.

## Network semantics

`gate` is the local deterministic path. Network/provider work is an explicit
choice (`--allow-network`), not an implicit requirement of a local gate. A
network failure or an unavailable provider must remain distinguishable from a
failed test assertion. If a release policy requires current provider evidence,
an unavailable or missing provider observation blocks or makes the decision
inconclusive as the machine report states. An `unknown` provider state or
unknown non-zero process status is infrastructure/inconclusive until the
machine report explains it; never treat an unknown value as PASS.

Inspect `networkBoundary` when present. An application fetch guard is scoped to
worker `globalThis.fetch`; it does not isolate raw sockets, child processes,
native addons, or arbitrary evaluator code. Older runtimes may advertise only
an offline application flag. Require verified OS isolation when the task calls
for universal network denial; do not infer containment from `evidenceMode`.
