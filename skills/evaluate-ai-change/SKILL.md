---
name: evaluate-ai-change
description: Determine and execute the smallest defensible EvalGate workflow for a change that may affect AI behavior. Use for prompts, models, tools, agents, retrieval, skills, MCP, judges, datasets, routing, safety, cost, latency, or release policy; skip it for changes proven not to affect observable AI behavior.
---

# Evaluate an AI change

The skill gives the agent evaluation discipline. EvalGate supplies execution,
evidence, history, permissions, and enforcement.

## Decide whether evaluation is required

Inspect the requested diff and the repository before running anything. Invoke an
EvalGate workflow when the change can alter observable behavior, including:

- prompts, system instructions, model/provider choice, parameters, or routing;
- agent orchestration, tools, schemas, permissions, skills, or MCP integrations;
- retrieval, context, memory, structured output, judges, datasets, or harnesses;
- business logic on an AI execution path; or
- quality, safety, reliability, latency, cost, or release-gating behavior.

Do not run EvalGate merely because a repository contains AI code. If the change
is demonstrably isolated from observable AI behavior, record that reasoning and
continue with the repository's ordinary tests. When uncertainty is material,
start with impacted coverage and expand only as the evidence requires.

Read [behavioral-change-detection.md](references/behavioral-change-detection.md)
when impact or scope is ambiguous.

## Inspect before acting

1. Read repository instructions and preserve its package manager and test flow.
2. Locate `evalgate.config.json`, evaluation files, datasets, reviewed baselines,
   quality profiles, traces, judge configuration, experiment history, and CI.
3. Run `npx @evalgate/sdk understand --format json` to preview an evidence-backed
   product theory. Treat detections as hypotheses, not runtime facts.
4. State the intended behavior change, affected surfaces and slices, existing
   coverage, missing evidence, and the minimum sufficient evaluation scope.
5. Ask for approval before writes, tests with meaningful cost or side effects,
   baseline changes, cloud access, credential creation, or release mutations.

Use [eval-authoring.md](references/eval-authoring.md) when new coverage is
needed. Do not invent a parallel configuration when the repository already has
a canonical EvalGate workflow.

## Select the workflow

- No reviewed scaffold: use
  [setup-evalgate-project](../setup-evalgate-project/SKILL.md).
- Reviewed baseline or PR gate: use
  [run-regression-gate](../run-regression-gate/SKILL.md).
- Missing runtime evidence: use
  [collect-agent-traces](../collect-agent-traces/SKILL.md).
- Connected immutable repository question: use
  [ask-repository-question](../ask-repository-question/SKILL.md).
- Public docs or scoped read-only product context: use
  [use-evalgate-mcp](../use-evalgate-mcp/SKILL.md).

Prefer `npx @evalgate/sdk capabilities --format json` and the published CLI help
over remembered commands. Hosted actions require an attributable,
organization-scoped credential. Never request, print, or commit its value.

## Evaluate and classify

Run the smallest sufficient suite, then inspect case-level and slice-level
evidence rather than only the aggregate score. Classify the result with exactly
one canonical value: `not_applicable`, `behavioral_change`, `experiment`,
`coverage_gap`, `infrastructure_failure`, `regression`, `improvement`,
`tradeoff`, or `inconclusive`.

Read [decision-contract.md](references/decision-contract.md) before serializing
or persisting a result. It defines classification precedence and the only valid
`classification` → `invokeEvalGate` → `releaseDecision` combinations. Never
invent a synonym or select the release decision independently.

Read [regression-analysis.md](references/regression-analysis.md) for failure and
slice analysis, [experiment-analysis.md](references/experiment-analysis.md) for
variant or Skill comparisons, and
[cost-optimization.md](references/cost-optimization.md) for joint quality,
latency, reliability, token, and cost decisions.

## Never game the evidence

Do not weaken thresholds, delete failures, rewrite expected outputs to fit the
candidate, silently move a baseline, suppress failures, cherry-pick trials,
discard inconvenient evidence, reduce coverage without explanation, bypass a
gate, mutate historical evidence, or call judge disagreement proof of product
correctness. A better aggregate does not excuse a protected-slice regression.

When a legitimate regression appears, fix the implementation and rerun the
affected scope. Baseline changes require explicit review of an intentional
behavioral contract change. Read
[release-gates.md](references/release-gates.md) before recommending promotion.

## Convert reusable failures into coverage

When existing coverage missed a real failure:

1. establish the root cause and whether the risk can recur;
2. create or propose the smallest durable case, assertion, slice, or trace;
3. prove the coverage detects the bad behavior;
4. fix the implementation;
5. prove the new coverage passes; and
6. preserve provenance connecting failure, coverage, fix, and rerun.

Avoid brittle cases for incidental implementation details. Read
[evidence-and-provenance.md](references/evidence-and-provenance.md) for the
required handoff.

## Report the decision

Return the repository revision, behavioral impact, scope selected, commands
executed, cases and slices exercised, canonical classification and derived
release decision, quality/cost/latency/reliability evidence, artifacts,
remaining uncertainty, and release status. Separate product regressions from
invalid or incomplete execution. When returning JSON, conform to
[decision-contract.schema.json](assets/decision-contract.schema.json).

Use [troubleshooting.md](references/troubleshooting.md) when the workflow cannot
produce valid evidence. Never claim safety or release readiness for an
unexercised runtime, model, provider, dataset, authorization, or policy boundary.
