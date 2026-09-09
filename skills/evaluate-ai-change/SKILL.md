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

Route on what the caller asked for and what their context already authorizes.
The absence of a scaffold is not a reason to build one: it usually means
nobody has looked at the repository yet, and looking is read-only.

Establish two facts first, because they decide the branch:

- **Intent.** Understand something, evaluate a specific change, gate a
  release, or get reference material? Take the caller's stated intent over an
  inferred one.
- **Authorized context.** Is there a connected repository and a scoped
  credential (`evalgate auth status`), a local checkout, both, or neither?
  Never assume authority that has not been demonstrated.

Then:

| Intent | Authorized context | Workflow |
| --- | --- | --- |
| Understand a system, or scope a change before touching it | Connected repository + read scope | [ask-repository-question](../ask-repository-question/SKILL.md) — read-only, no scaffold, no write access |
| Understand a system | Local checkout only | `npx @evalgate/sdk understand --format json` |
| Evaluate a specific change | Reviewed scaffold and baseline exist | [run-regression-gate](../run-regression-gate/SKILL.md) |
| Evaluate a specific change | No reviewed scaffold, and the caller wants durable coverage | [setup-evalgate-project](../setup-evalgate-project/SKILL.md) |
| Explain behavior a static read cannot | Runtime evidence missing | [collect-agent-traces](../collect-agent-traces/SKILL.md) |
| Get reference material or scoped product state | Public docs, or a read scope | [use-evalgate-mcp](../use-evalgate-mcp/SKILL.md) |

Prefer the least authority that answers the question. A connected repository
with no scaffold and no write access can already reach evidence-linked
understanding through `evalgate repo`; do not route such a caller into
scaffolding, baseline acceptance, or a write grant to answer a question that
read scope already covers.

Escalate only when the intent requires it, and only with the specific
authority that step needs. Reading does not authorize executing, executing
does not authorize a patch, a patch does not authorize a push, and a passing
gate does not authorize a merge. A good result never widens a grant.

When the caller explicitly asks for local, offline, or credential-free work —
or is working from uncommitted changes, a restricted network, or a sandbox —
use the local path and do not route them to hosted signup. `evalgate init
--local` needs no credential and no network.

Prefer `npx @evalgate/sdk capabilities --format json` and the published CLI help
over remembered commands. When hosted access is needed, read the canonical
[authentication and credential handoff reference](references/authentication-and-credential-handoff.md).
Hosted actions require an attributable, organization-scoped credential. Never
request, print, or commit its value.

## Evidence triage

Before executing a release-bearing workflow, record the installed SDK version,
the capability contract, and the exact command help. Read those from the
runtime rather than from this document: the capability map and machine-readable
report are authoritative, and a version pinned in prose goes stale while the
contract keeps moving. Do not invent provider flags, numeric exit meanings, or
hosted routes from an older SDK.

The vocabulary below has held from 3.8 through the published 3.10.x contract
(`2026-09-03`), but verify it against `capabilities --format json` rather than
assuming it. `gate` is deterministic/offline by default, and `--allow-network`
is the explicit opt-in for provider-backed project evaluators. Use `--dry-run`
only as a preview, never as release evidence.

Classify the evidence mode separately from the product verdict:

- `offline`: deterministic local checks only;
- `network`: a provider-backed execution actually ran;
- `mixed`: both kinds of evidence are present;
- `cache_only`: an eligible cached observation was reused without new model
  inference.

For every provider-backed result, preserve the requested and effective
provider/model identity, execution state, calibration state, cache lineage,
case and slice counts, and any request or run IDs. The provider vocabulary
distinguishes `executed`, `cache_reused`, `deferred_by_policy`,
`provider_unavailable`, `model_retired`, `authentication_failed`,
`timed_out`, `malformed_response`, `policy_blocked`, and other states. Apply
the report's `requiredNow`, `freshCacheAllowed`, `deferredAllowed`, and fresh
calibration policy rather than guessing:

- an unavailable provider means quality is **not determined** and readiness is
  blocked or inconclusive, not a product regression and not a pass;
- a deferred obligation remains unresolved and is not PASS;
- admission policy fields `requiredNow`/`required_now`,
  `freshCacheAllowed`/`fresh_cache_allowed`, and
  `deferredAllowed`/`deferred_allowed` (and, when present,
  `requireFreshCalibration`) govern whether evidence is eligible now;
- when fresh calibration is required, `stale` or `not_comparable` calibration
  cannot establish current provider trust;
- a cache hit is usable only when canonical identity and freshness are eligible
  under the active policy. Retain original execution/model lineage and report
  zero new inference cost; never call it an independent trial;
- a fallback provider/model is valid only when explicitly authorized and fully
  recorded. Never silently substitute one.

For a judge request, verify the operational path in the evidence rather than
accepting a cache design claim: canonical request identity → authorized cache
lookup → eligible fresh hit (reuse original lineage, record `cache_reused`, and
incur `$0` new inference) **or** Model Gateway execution → provider/model call
and cost ledger → cache write. A missing identity, authorization, freshness,
lineage, cost, or write receipt leaves the run incomplete and therefore
inconclusive; it is not proof that the cache is operational.

Release evidence has independent dimensions. Inspect the machine report for
verdict, gate mode, case/slice outcomes, `decisionPassed`, `reportingPassed`,
`evidencePassed`, `evidenceMode`, provider admission, trajectory evidence, and
`releaseReady`. A passing score, a zero process exit, or a final answer alone
does not establish release readiness. Active golden agent cases require a
complete trajectory observation for the tool path, order, arguments, and
outcomes; missing or truncated observations fail closed, and an unsafe
intermediate tool action remains a failure even when the final answer is right.

For red-team or framework-control work, use the hosted capability and scoped
API only when discovered in the installed contract. Keep attack evidence and
benign utility evidence distinct. A framework/control reference records
provenance and a reviewed mapping rationale; it does not prove implementation,
compliance, certification, endorsement, partnership, or affiliation.

In the published capability map, red-team is a cloud capability at the
`/red-team` workspace. The documented CLI/API discovery entry is
`evalgate api get_red_team_workspace --format json`; campaign, run, finding,
promotion, and signed-report operations are exposed by the returned contract,
not by an invented local command. Missing observations or a provider failure
remain incomplete evidence, not a passing control result.

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
executed, cases and slices exercised, evidence mode, provider/cache/trajectory
state, canonical classification and derived release decision,
quality/cost/latency/reliability evidence, artifacts, remaining uncertainty,
and release readiness. Separate product regressions from invalid or incomplete
execution. When returning JSON, conform to
[decision-contract.schema.json](assets/decision-contract.schema.json).
The required `evidenceSummary` covers quality, protected slices, reliability,
latency, and cost. Use `status: "not_measured"` with a concrete reason when a
dimension has no valid evidence; never estimate, infer, or fabricate a metric
just to complete the object.

Use [troubleshooting.md](references/troubleshooting.md) when the workflow cannot
produce valid evidence. Never claim safety or release readiness for an
unexercised runtime, model, provider, dataset, authorization, or policy boundary.
