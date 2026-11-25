# EvalGate Agent Skills

[![Validate Agent Skills](https://github.com/evalgate/skills/actions/workflows/validate.yml/badge.svg)](https://github.com/evalgate/skills/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Portable evaluation discipline for agents changing AI-enabled systems. The
distribution connects agent instructions to EvalGate's real CLI, SDK, API, MCP,
evidence, and release-gating surfaces.

> The skills teach an agent when, why, and how to evaluate a change. EvalGate's
> runtime and control plane perform execution, persistence, permissions,
> auditability, and enforcement.

This public repository contains no EvalGate application source, customer data,
private prompts, proprietary scoring logic, or internal control mappings.

Canonical source: [github.com/evalgate/skills](https://github.com/evalgate/skills).
The distribution version is independent from the SDK version. Read the verified
SDK version and command inventory from the [runtime truth ledger](evaluations/convergence-truth-ledger.md)
and `evaluations/runtime-contract.json`; discover current commands from the installed runtime.
The repository's `plugin.json` and `package.json` are machine-readable metadata.

There is no npm package named `@evalgate/skills`. Install from the Skills
registry using the repository path below.

Coding agents should begin with [`AGENTS.md`](AGENTS.md), which routes them to
the smallest applicable Skill and preserves the canonical decision contract.

## Install

Install the complete project-local collection from the canonical repository:

```bash
npx skills add evalgate/skills
```

Install only the primary workflow (self-contained; sibling skills are optional):

```bash
npx skills add evalgate/skills --skill evaluate-ai-change
```

Install globally when the client supports user-wide skills:

```bash
npx skills add evalgate/skills --skill evaluate-ai-change --global
```

The everyday-assistant skill is a separate persona, so a default install into a
coding agent does not load it. Install it on its own:

```bash
npx skills add https://github.com/evalgate/skills/tree/main/everyday
```

Inspect what will be discovered before installation:

```bash
npx skills add evalgate/skills --list
```

The repository uses the standard `skills/<name>/SKILL.md` layout. Compatibility
is verified with the pinned `skills` CLI in CI; support in another installer or
agent is not implied until that client is tested.

The primary workflow is [`skills/evaluate-ai-change/SKILL.md`](skills/evaluate-ai-change/SKILL.md).
It routes to focused setup, gate, trace, MCP, authoring, provenance, and release
references using progressive disclosure.

## Skills

Engineering skills (`skills/`, installed by default):

- `evaluate-ai-change`: primary host-neutral decision framework for AI changes,
  responses, non-repository artifacts, and non-chat events, including minimum
  sufficient coverage, result classification, anti-gaming, failure-to-eval
  conversion, experiments, and release decisions.
- `setup-evalgate-project`: preview and apply a reviewed first project scaffold.
- `run-regression-gate`: run and interpret a gate without weakening policy.
- `collect-agent-traces`: add bounded, redacted trace evidence.
- `ask-repository-question`: inspect an authorized immutable repository snapshot.
- `use-evalgate-mcp`: use public documentation, scoped product reads, and
  approved, permission-bound evaluation authoring tools.
- `report-evalgate-friction`: when an EvalGate command, flag, report field or
  skill instruction contradicts what actually happened, draft a short redacted
  report and file it only with the person's approval.

Everyday persona (`everyday/`, installed separately):

- `everyday-ai`: for nontechnical work in Microsoft 365 Copilot Chat, ChatGPT
  or Claude, turn a correction the person wants remembered into one short rule
  and reuse it for that kind of work. Works with no setup, keeping rules in the
  assistant or with the person. If the assistant is already connected to
  EvalGate (pilot, not yet released), it saves the correction and suggests a
  personal rule there instead. It never asks anyone to sign up.

The primary skill uses progressive disclosure: its entry point contains the
decision loop and routes detailed authoring, regression, experiment, cost,
provenance, and troubleshooting guidance through focused references.
Portable artifact checks additionally route to one bundled reference that
separates host capability from user authority. A Skill install does not grant
attachment access or background hooks. The product MCP can perform specific
released, scope-filtered evaluation/connection mutations only with appropriate
authorization and explicit user approval; a Skill install does not grant it.

## Core workflow

```text
change
→ determine behavioral impact
→ inspect existing coverage
→ select the smallest defensible evaluation scope
→ run the canonical EvalGate workflow
→ inspect case, slice, quality, cost, latency, and reliability evidence
→ classify regression / improvement / inconclusive / infrastructure failure
→ fix the implementation rather than gaming the gate
→ rerun and preserve durable evidence
```

Local planning and deterministic checks use the documented [EvalGate CLI](https://www.evalgate.com/docs/sdk/cli).
Hosted product state, repository intelligence, and traces require an
attributable organization-scoped API key. The public documentation MCP remains
anonymous and read-only. The product MCP can expose `evaluations.create`,
`test_cases.add`, `runs.start`, and `traces.create` only to authorized
callers. See [scoped MCP authoring](skills/use-evalgate-mcp/references/scoped-authoring.md)
and [MCP Registry publication](docs/MCP_REGISTRY.md).

## How the skills are evaluated

Four layers, from cheapest to most realistic. Only the last two execute a model.

1. **Lint** (`npm run lint:skills`). Pass/fail rules on every skill: a spec in
   `specs/`, body and description budgets, a numbered workflow, a `## Recovery`
   section linking the bundled `failure-recovery.md` table for CLI skills, no
   unbounded "retry" advice, every bundled reference reachable from SKILL.md,
   no MCP server files inside a skill, the spec's required commands present and
   its forbidden patterns absent. `--report` prints the token budget per skill.
2. **Contract fixtures** (`npm test`). The decision scenarios for
   `evaluate-ai-change` (`evaluations/evaluate-ai-change.scenarios.jsonl`,
   including adversarial cases A to S), case files for every other skill
   (`evaluations/skills/*.cases.jsonl`), and a scorer self-test. These report
   `executed: false`; a green fixture run is never a behavioral claim.
3. **Ablation of the primary skill** (`npm run test:ablation -- --provider
   anthropic --model <id>`). Runs every decision scenario with and without
   `evaluate-ai-change`, repeated `--trials` times, and reports pass rate with a
   95% interval per arm, the paired wins and losses, the **noise band** (how
   often identical trials disagree), whether the difference exceeds it, and the
   token cost per scenario of each arm. The without arm keeps the output schema
   and removes only the skill, so a difference is attributable to it.
4. **Behavior tests for every skill** (`npm run test:skills:live -- --provider
   anthropic --model <id>`). Each case runs with and without its skill. Trigger
   precision, recall and F1 and the paired task uplift (with a bootstrap 95%
   interval and sign test) come from EvalGate's own
   `npx @evalgate/sdk skill test --observations`. The command order, forbidden
   actions and commands, action order, and which skill files the agent read are
   scored by `scripts/score-skill-trajectory.mjs`. Observations are written to
   `.evalgate/skill-tests/` so a run can be rescored.

Live runs use **progressive loading** by default: the agent sees only each
skill's name and description, then asks to load a SKILL.md and to read single
references, as a real Agent Skills client does. `--loading bundle` (everything
in one prompt) remains available as a ceiling. Both use the shared loop in
`scripts/lib/agent-loop.mjs`.

To score with the SDK runner directly:

```bash
npx @evalgate/sdk skill test --skill skills/run-regression-gate \
  --cases .evalgate/skill-tests/run-regression-gate.sdk-cases.jsonl --trials 3 --format json \
  --runner "node scripts/skill-test-runner.mjs --provider anthropic --model <id>"
```

Every case records its `source`: `authored`, `real` or `golden`. Today all
cases are authored. The target mix is mostly real prompts graded on
trajectory; redacted prompts from friction reports and accepted issues are the
intended source, added as `real` cases.

Pass rates of 70% to 90% on non-deterministic cases can be healthier than
100%: a case every model always passes may not be measuring anything. Read a
lift only against the noise band.

The earlier entry points still work: `node scripts/score-skill-evaluation.mjs
path/to/results.jsonl --json` scores serialized decisions, and
`node scripts/evaluate-ai-change-harness.mjs --mode fixture | live | compare`
keeps its adapter contract (`evaluateScenario({ scenario, skill, arm })`).
Missing credentials are reported as skipped, never as a pass; a requested live
run with zero executions exits `2` unless `--allow-skip` is set. Built-in
adapters read only `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` and never print or
persist them.

## Keeping skills correct over time

- **Recovery table.** `skills/evaluate-ai-change/references/failure-recovery.md`
  maps each envelope `code` / `failureClass` and gate code from the SDK to what
  to do and what never to do. It is copied byte for byte into every CLI skill by
  `scripts/check-standalone.mjs --sync`.
- **Friction reports.** `report-evalgate-friction` lets an agent turn drift it
  hits (a rejected flag, a missing field, a code the table lacks) into a
  redacted issue using `.github/ISSUE_TEMPLATE/papercut.yml`, labelled
  `papercut`. Agents search existing papercuts first and reuse known
  workarounds.
- **SDK papercut ledger.** `evaluations/sdk-papercuts.json` lists every
  workaround the skills carry because of SDK behavior, with the SDK fix that
  would let us delete it. The linter fails if an open workaround disappears
  without the ledger being updated, or if a fixed one is still in a skill.
- **Specs.** `specs/<skill>.spec.json` records each skill's goal, outputs,
  required commands, forbidden patterns, target agents and models, and budget.
  The spec, not the wording, is what must survive a rewrite for a new model.

## MCP servers

- Primary registry identity: `com.evalgate/evalgate`; documentation companion:
  `com.evalgate/evalgate-docs`. This repository distributes their connection
  metadata; the domain-verified platform pipeline owns registry publication.
- Product MCP: `https://www.evalgate.com/api/mcp` — public protocol/schema
  discovery; scoped credentials required for organization tools.
- Documentation MCP: `https://www.evalgate.com/api/mcp/docs` — public,
  read-only reviewed documentation.

The Agent Plugin configuration is published in [`mcp.json`](mcp.json). An
installed MCP server adds every tool definition to every request; measure that
cost with `npm run measure:mcp` (set `EVALGATE_API_KEY` to see the
role-filtered list an authenticated agent loads). Skills never install MCP
servers themselves; the linter rejects MCP files inside a skill. Never
commit credentials into MCP configuration. MCP results are evidence inputs, not
a separate release-decision format: an agent using them must emit the canonical
`evaluate-ai-change` classification and derived release decision.

## Team use

Install the selected skill into the repository's supported agent directory and
commit it when the team wants one reviewed version shared through source
control. Review every installed skill before allowing it to run commands. Keep
customer prompts, datasets, and evidence in the customer's authorized EvalGate
project or repository—not in this public distribution.

## Public references

- [EvalGate platform](https://evalgate.com)
- [Developer hub](https://www.evalgate.com/developers)
- [Machine-readable developer index](https://www.evalgate.com/developers.md)
- [Authentication walkthrough](https://www.evalgate.com/auth.md)
- [OpenAPI 3.2](https://www.evalgate.com/openapi.json)
- [CLI reference](https://www.evalgate.com/docs/sdk/cli)
- [EvalGate SDK on npm](https://www.npmjs.com/package/@evalgate/sdk)
- [Privacy](https://www.evalgate.com/privacy)
- [Terms](https://www.evalgate.com/terms)

## License

MIT

## Website publication

Generate the public website distribution from this repository at a reviewed commit:

```bash
node scripts/export-website.mjs --output /path/to/website/public
node scripts/export-website.mjs --output /path/to/website/public --check
```

The exporter copies every skill reference and asset, the canonical decision schema
at `/schemas/evaluate-ai-change-decision.schema.json`, and an index plus SHA-256
manifest under `/.well-known/agent-skills/`. Check mode rejects changed, missing,
or stale skill files. Run generation and check in the website build; merge this
repository and update the website's pinned source commit together. This PR does
not deploy or synchronize the currently served website copy by itself.

Single-skill installs include their own required references. Shared child references
are generated by `scripts/check-standalone.mjs --sync` and checked byte-for-byte
against the primary references; edit the canonical originals first.

Scheduled and manually requested live CI must execute and score real model output;
missing credentials fail the job. Fixture tests validate the contract only and
remain explicitly `executed: false`. A green fixture job is not a behavioral
improvement claim; compare immutable skill versions using executed model trials.

Python package publication and discovery-index re-indexing are separate release
work. Discover the installed Python CLI capabilities before choosing it; use the
Node CLI when the requested command is absent. Never assume a source-tree version
has already reached PyPI or that a third-party listing has refreshed.
