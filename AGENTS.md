# EvalGate Agent Skills repository instructions

This repository is the public, sauce-safe distribution for EvalGate Agent
Skills. It contains portable evaluation workflows and their executable
contracts; it does not contain the private EvalGate application.

## Start here

1. Read `README.md` for the supported installation and product boundaries.
2. For a behavioral code change, read
   `skills/evaluate-ai-change/SKILL.md` and only the references it routes you to.
3. Preserve the canonical decision vocabulary and mappings in
   `skills/evaluate-ai-change/assets/decision-contract.schema.json`.
4. Use the narrower skill under `skills/` when its stated trigger matches the
   task; do not load every skill by default.

## Safety and product boundaries

- Never add customer prompts, datasets, traces, credentials, private repository
  content, or proprietary EvalGate scoring logic to this public repository.
- Treat MCP product results as read-only evidence. Product operations require
  an attributable organization-scoped credential; the documentation MCP is
  anonymous and public-content-only.
- Do not weaken a release gate, remove protected slices, relabel a regression,
  or fabricate an unmeasured metric to make a result pass.
- Keep `classification`, `invokeEvalGate`, and `releaseDecision` consistent with
  the canonical contract. Use `not_measured` with a reason when evidence does
  not exist.

## Verification

Run `npm test` after changing a skill, reference, schema, scenario, fixture, or
distribution manifest. The distribution validator, decision-contract tests,
and scenario scorer are release-blocking evidence.

