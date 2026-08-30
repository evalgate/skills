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
The current distribution is **Agent Skills 1.2.x**, aligned with the published
[EvalGate SDK 3.8.x](https://www.npmjs.com/package/@evalgate/sdk) capability
contract. The Skills distribution version is independent from the SDK version;
the repository's `plugin.json` and `package.json` are machine-readable metadata.

There is no npm package named `@evalgate/skills`. Install from the Skills
registry using the repository path below.

Coding agents should begin with [`AGENTS.md`](AGENTS.md), which routes them to
the smallest applicable Skill and preserves the canonical decision contract.

## Install

Install the complete project-local collection from the canonical repository:

```bash
npx skills add evalgate/skills
```

Install only the primary workflow:

```bash
npx skills add evalgate/skills --skill evaluate-ai-change
```

Install globally when the client supports user-wide skills:

```bash
npx skills add evalgate/skills --skill evaluate-ai-change --global
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

- `evaluate-ai-change` — primary decision framework for behavioral impact,
  minimum sufficient coverage, result classification, anti-gaming,
  failure-to-eval conversion, experiments, and release decisions.
- `setup-evalgate-project` — preview and apply a reviewed first project scaffold.
- `run-regression-gate` — run and interpret a gate without weakening policy.
- `collect-agent-traces` — add bounded, redacted trace evidence.
- `ask-repository-question` — inspect an authorized immutable repository snapshot.
- `use-evalgate-mcp` — use public docs or scoped read-only product MCP tools.

The primary skill uses progressive disclosure: its entry point contains the
decision loop and routes detailed authoring, regression, experiment, cost,
provenance, and troubleshooting guidance through focused references.

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
anonymous and read-only.

## Evaluate the skill

`evaluations/evaluate-ai-change.scenarios.jsonl` defines 30 provider-neutral
decision scenarios, including adversarial cache, provider, trajectory,
credential, runner, red-team, and anti-gaming cases A–S. Run an agent with and without the skill, serialize its
decisions to JSONL, then score them:

```bash
node scripts/score-skill-evaluation.mjs path/to/results.jsonl --json
```

The scorer reports decision correctness and evidence-reporting completeness as
separate results. It checks activation, primary classification, release
decision, required actions, prohibited anti-gaming behavior, the canonical
decision enum, and explicit coverage of quality, protected slices, reliability,
latency, and cost. Unknown labels and contradictory classification/release
combinations fail decision scoring; missing measured evidence fails reporting
scoring. `not_measured` is valid only with a reason, so agents can stay complete
without fabricating metrics. The scorer does not pretend to run an agent or
replace EvalGate's runtime evidence. Compare Skill versions as immutable
experiment candidates and retain the agent/model, trials, dataset, tokens,
cost, latency, and result provenance.

For a provider-neutral behavioral smoke test, run the deterministic harness:

```bash
node scripts/evaluate-ai-change-harness.mjs
```

The harness reports `mode: "contract_fixture"` and `executed: false` so its
passing result cannot be mistaken for a live provider or runtime evaluation.
An integration may opt into live mode with a credential-safe ESM adapter that
exports `evaluateScenario({ scenario })`; without an adapter, live mode returns
`not_run` rather than fabricating execution evidence.

Validate the distribution and positive/negative fixtures:

```bash
npm test
npm run test:behavior
```

The committed behavioral harness is provider-neutral. Its default
`contract_fixture` mode checks the decision and evidence contract without
pretending to run an agent or model; an optional live adapter must be supplied
explicitly and receives the primary Skill, every routed child Skill, and the
reviewed references used by that routing path. It reports whether it actually
executed. See the
[3.8 convergence truth ledger](evaluations/3.8-convergence-truth-ledger.md) for
the runtime facts this distribution is allowed to teach.

```bash
node scripts/evaluate-ai-change-harness.mjs --mode fixture
node scripts/evaluate-ai-change-harness.mjs --mode live --adapter ./my-adapter.mjs
node scripts/evaluate-ai-change-harness.mjs --mode live --provider openai --model <model-id>
node scripts/evaluate-ai-change-harness.mjs --mode live --provider openai --model <model-id> --allow-skip
node scripts/evaluate-ai-change-harness.mjs --compare ./adapter-a.mjs,./adapter-b.mjs
node scripts/evaluate-ai-change-harness.mjs --compare-providers openai:<model-a>,anthropic:<model-b>
```

The comparison form is an optional model/provider experiment boundary: each
adapter owns its credential-safe invocation and should export provenance such
as provider and model in `metadata`. Missing credentials or an absent adapter
is reported as skipped/not run, never as a fabricated pass. A requested live or
comparison run with zero executions exits with status `2`; pass `--allow-skip`
only when an explicitly allowed skip is desired. It does not turn skipped
reports into behavioral evidence. Built-in OpenAI and Anthropic adapters are
opt-in and read only `OPENAI_API_KEY` or
`ANTHROPIC_API_KEY` from the process environment; they never print or persist
those values.

## MCP servers

- Product MCP: `https://www.evalgate.com/api/mcp` — public protocol/schema
  discovery; scoped credentials required for organization tools.
- Documentation MCP: `https://www.evalgate.com/api/mcp/docs` — public,
  read-only reviewed documentation.

The Agent Plugin configuration is published in [`mcp.json`](mcp.json). Never
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
