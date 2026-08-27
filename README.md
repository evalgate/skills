# EvalGate Agent Skills

Portable evaluation discipline for agents changing AI-enabled systems. The
distribution connects agent instructions to EvalGate's real CLI, SDK, API, MCP,
evidence, and release-gating surfaces.

> The skills teach an agent when, why, and how to evaluate a change. EvalGate's
> runtime and control plane perform execution, persistence, permissions,
> auditability, and enforcement.

This public repository contains no EvalGate application source, customer data,
private prompts, proprietary scoring logic, or internal control mappings.

## Install

Install the complete project-local collection:

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

Local planning and deterministic checks use the documented EvalGate CLI.
Hosted product state, repository intelligence, and traces require an
attributable organization-scoped API key. The public documentation MCP remains
anonymous and read-only.

## Evaluate the skill

`evaluations/evaluate-ai-change.scenarios.jsonl` defines eleven provider-neutral
decision scenarios. Run an agent with and without the skill, serialize its
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

Validate the distribution and positive/negative fixtures:

```bash
npm test
```

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

- [Developer hub](https://www.evalgate.com/developers)
- [Machine-readable developer index](https://www.evalgate.com/developers.md)
- [Authentication walkthrough](https://www.evalgate.com/auth.md)
- [OpenAPI 3.2](https://www.evalgate.com/openapi.json)
- [CLI reference](https://www.evalgate.com/docs/sdk/cli)
- [Privacy](https://www.evalgate.com/privacy)
- [Terms](https://www.evalgate.com/terms)

## License

MIT
