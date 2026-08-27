# Regression analysis

Use this reference after a gate, experiment, or trace-backed evaluation reports
a failure or conflicting evidence.

## Separate the failure domains

- Product regression: the candidate behavior fails valid evidence.
- Evaluator defect: the assertion, judge, or rubric is invalid or unstable.
- Provider drift: otherwise unchanged behavior moved with a provider/model.
- Infrastructure failure: timeout, unavailable provider, missing data,
  malformed output, runner crash, or incomplete execution.
- Insufficient evidence: too few eligible cases, trials, or aligned labels.

Never translate the latter four into a product pass. Preserve the original
status and evidence.

## Inspect below the aggregate

Compare case deltas, protected slices, failure modes, tool ordering and
arguments, reliability, latency, tokens, and cost. A candidate is not an
improvement when a material protected slice regresses, even if the aggregate
score rises.

Fix legitimate product behavior before rerunning. When the evaluator is wrong,
repair it through the reviewed evaluator workflow and rerun both baseline and
candidate; do not edit a result in place.
