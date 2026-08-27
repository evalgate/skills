# Experiment and Skill analysis

Use this reference to compare prompts, models, tools, routing, harnesses, or
Agent Skill versions.

Freeze the baseline and candidate identities, source revision, configuration,
dataset/slices, model/provider, tool policy, and trial plan. Change one intended
variable at a time when causal attribution matters. Use enough repetitions to
separate a stable effect from ordinary variability.

For Agent Skills, compare at least:

- agent without the Skill;
- agent with the reviewed baseline Skill; and
- agent with the candidate Skill.

Measure task completion, correctness, behavioral assertions, tool-use quality,
retries, tokens, cost, latency, verbosity, unsafe behavior, and reliability.
Preserve case-level evidence and candidate provenance. Reject or mark
inconclusive any candidate that wins only through a favorable trial, overfits
one dataset, or causes an unacceptable protected-slice or operational tradeoff.

The files under `evaluations/` in the public distribution define portable
decision scenarios. They test the Skill's classification discipline; they do
not replace a real agent runner or EvalGate's runtime evidence.
