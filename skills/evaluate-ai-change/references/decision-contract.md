# Decision contract

Use the exact canonical values below whenever a result is serialized, persisted,
passed to another tool, or returned as JSON. The machine-readable source of
truth is [decision-contract.schema.json](../assets/decision-contract.schema.json).
Never invent synonyms such as `pass`, `fail`, `hold`, `error`, or `needs_evals`.

## Canonical mapping

| `classification` | Meaning | `invokeEvalGate` | `releaseDecision` |
| --- | --- | ---: | --- |
| `not_applicable` | The inspected change cannot affect observable AI behavior. | `false` | `ordinary_tests` |
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

1. Use `not_applicable` only after proving there is no behavioral impact.
2. Use `infrastructure_failure` when execution was invalid; do not infer product quality.
3. Use `regression` when a material or protected-slice regression is established.
4. Use `coverage_gap` when a recurring material risk cannot yet be evaluated durably.
5. Use `tradeoff` when valid evidence has competing material outcomes requiring policy review.
6. Use `inconclusive` when the run is valid but the evidence cannot support a decision.
7. Use `experiment` while a controlled comparison is planned or still in progress.
8. Use `improvement` only after valid evidence clears regressions and accepted policy limits.
9. Otherwise use `behavioral_change` and run the required evaluation.

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
scorer. `actions` contains concrete next actions, not alternative enum labels.
