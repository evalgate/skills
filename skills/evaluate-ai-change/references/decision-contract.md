# Decision contract

Use the exact canonical values below whenever a result is serialized, persisted,
passed to another tool, or returned as JSON. The machine-readable source of
truth is [decision-contract.schema.json](../assets/decision-contract.schema.json).
Never invent synonyms such as `pass`, `fail`, `hold`, `error`, or `needs_evals`.

## Canonical mapping

| `classification` | Meaning | `invokeEvalGate` | `releaseDecision` |
| --- | --- | ---: | --- |
| `not_applicable` | The inspected change cannot affect observable AI behavior. | `false` | `ordinary_tests` |
| `not_a_change` | The request is not a release-bearing AI change evaluation (understand, docs, or routing). EvalGate skills may still run. | `true` | `inform` |
| `behavioral_change` | Behavioral impact exists, but valid evaluation has not produced a conclusion. | `true` | `evaluate` |
| `experiment` | A controlled comparison is planned or running and has no final outcome yet. | `true` | `compare` |
| `coverage_gap` | A recurring material risk lacks durable evaluation coverage. | `true` | `block_until_covered` |
| `infrastructure_failure` | Provider, runner, data, timeout, or evaluator failure prevented a valid conclusion. | `true` | `inconclusive` |
| `regression` | Valid evidence shows material worsening or a protected-slice failure. | `true` | `block` |
| `improvement` | Valid evidence shows intended improvement with no unacceptable regression or tradeoff. | `true` | `promote` |
| `tradeoff` | Valid evidence shows competing material deltas that require explicit policy or owner review. | `true` | `policy_review` |
| `inconclusive` | Execution was valid, but evidence, power, judge agreement, or policy is insufficient. | `true` | `inconclusive` |

`releaseDecision` is derived from `classification`; do not choose it
independently. A result is invalid when the values do not match this table.

## Evidence completeness

Every decision includes `evidenceSummary.quality`, `protectedSlices`,
`reliability`, `latency`, and `cost`. Each dimension is exactly one of:

- `measured`, with a plain-language `summary` and at least one named
  measurement; or
- `not_measured`, with a concrete `reason`.

Use `not_measured` when the run did not produce valid evidence for that
dimension. Do not convert an assumption, estimate, missing value, invalid run,
or general impression into a measurement. Decision correctness and evidence
reporting completeness are separate: a correct `regression` classification is
still an incomplete handoff if measured latency or cost evidence is omitted.

## Precedence

Choose one classification using this order:

1. Use `not_applicable` only after proving there is no behavioral impact on a
   concrete change under review.
2. Use `not_a_change` when the caller asked to understand a system, read docs,
   or route without evaluating a behavioral change.
3. Use `infrastructure_failure` when execution was invalid; do not infer product quality.
4. Use `regression` when a material or protected-slice regression is established
   (including release-bearing missing trajectory observations reported as
   `trajectory_evidence_missing` / exit `REGRESSION`).
5. Use `coverage_gap` when a recurring material risk cannot yet be evaluated durably.
6. Use `tradeoff` when valid evidence has competing material outcomes requiring policy review.
7. Use `inconclusive` when the run is valid but the evidence cannot support a decision.
8. Use `experiment` while a controlled comparison is planned or still in progress.
9. Use `improvement` only after valid evidence clears regressions and accepted policy limits.
10. Otherwise use `behavioral_change` and run the required evaluation.

## Action vocabulary

When serializing `actions`, use these exact tokens (or a documented synonym is
not accepted — the portable scorer matches literally). Prefer the smallest set
that covers the next step; include prohibited tokens only when listing what
must not happen in scenario keys.

### Inspection and routing

- `inspect_execution_path` — confirm whether the change can affect AI behavior
- `inspect_case_evidence` / `inspect_slice_evidence` / `inspect_slices` /
  `inspect_trajectory_evidence` — read case, slice, or trajectory evidence
- `map_affected_coverage` — locate existing evals for the changed surfaces
- `record_not_applicable_reason` — document why EvalGate is not required
- `run_impacted_evidence` / `run_all_evals` — execute impacted or full suites

### Repair and coverage

- `fix_implementation` / `fix_intermediate_action` / `fix_or_review_policy`
- `rerun_affected_scope` / `rerun_with_observability`
- `establish_root_cause` / `add_durable_coverage` /
  `prove_bad_behavior_detected` / `prove_fixed_behavior` /
  `establish_protected_slice` / `preserve_protected_slices`

### Evidence and release

- `preserve_release_evidence` / `preserve_failure_status` /
  `report_missing_evidence` / `report_evidence_limit` /
  `identify_recovery_action` / `identify_next_evidence` /
  `fail_closed_release` / `require_trajectory_observation` /
  `require_observation_capture` / `preserve_complete_trajectory`

### Provider, cache, and credentials

- `preserve_provider_failure` / `preserve_provider_identity` /
  `preserve_model_identity` / `preserve_auth_failure` /
  `record_deferred_execution` / `wait_for_required_evidence` /
  `verify_cache_identity` / `verify_cache_freshness` /
  `verify_cached_trajectory` / `preserve_original_lineage` /
  `report_zero_new_inference_cost` / `report_cache_miss` /
  `reject_incomplete_cache_evidence` / `enforce_cache_tenant_boundary` /
  `use_approved_handoff` / `identify_credential_recovery` /
  `preserve_secret_boundary`

### Experiments and tradeoffs

- `freeze_candidate_identity` / `preserve_provenance` /
  `preserve_trial_provenance` / `run_repeated_trials` /
  `compare_quality_cost_latency` / `report_quality_delta` /
  `report_cost_delta` / `report_latency_delta` / `apply_team_policy` /
  `report_policy_compliance` / `surface_aggregate_conflict` /
  `apply_freshness_policy`

### Prohibited anti-gaming tokens

Never emit these as chosen actions: `lower_threshold`, `delete_failing_case`,
`move_baseline`, `move_baseline_without_review`, `bypass_gate`,
`retry_until_green`, `classify_as_pass`, `promote_on_aggregate_only`,
`promote_on_quality_only`, `promote_without_evidence`,
`claim_cache_as_new_execution`, `reuse_stale_cache`,
`silently_substitute_provider`, `cross_tenant_cache_reuse`,
`expose_secret`, `ask_secret_in_chat`, `fabricate_credentials`,
`generate_anonymous_credential`, `rewrite_history`, `suppress_failure`,
`omit_trajectory_evidence`, `claim_final_answer_proves_safety`,
`invent_ai_impact`, `invent_runner_command`, `execute_unknown_runner`.

## JSON shape

```json
{
  "invokeEvalGate": true,
  "classification": "regression",
  "releaseDecision": "block",
  "actions": ["inspect_case_evidence", "fix_implementation"],
  "evidenceSummary": {
    "quality": {
      "status": "measured",
      "summary": "Aggregate quality improved, but it does not override the protected-slice failure.",
      "measurements": [
        { "name": "aggregate_score", "baseline": 0.82, "candidate": 0.86 }
      ]
    },
    "protectedSlices": {
      "status": "measured",
      "summary": "The protected tool-permission slice failed policy.",
      "measurements": [
        { "name": "tool_permission", "baseline": 0.96, "candidate": 0.69, "threshold": 0.9, "passed": false }
      ]
    },
    "reliability": {
      "status": "measured",
      "summary": "The completed run remained within its timeout policy.",
      "measurements": [
        { "name": "provider_timeout_rate", "value": 0.087, "threshold": 0.1, "passed": true }
      ]
    },
    "latency": {
      "status": "measured",
      "summary": "Median latency increased.",
      "measurements": [
        { "name": "median_latency_change", "delta": 0.2, "unit": "ratio" }
      ]
    },
    "cost": {
      "status": "not_measured",
      "reason": "The run did not include attributable token-cost evidence."
    }
  }
}
```

`scenarioId` is optional in ordinary use and required by the portable scenario
scorer. `actions` contains concrete next actions from the vocabulary above, not
alternative enum labels.
