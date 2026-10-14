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
- MCP product access is scope-filtered: read evidence without mutation; create
  evaluations, test cases, runs or traces only when the current authenticated
  caller has the required write scope/role and explicitly approves the effect.
  The documentation MCP remains anonymous and public-content-only.
- Use `skills/use-evalgate-mcp/references/scoped-authoring.md` for supported
  write names, admin-only connector mutations and unshipped quality operations.
- Do not weaken a release gate, remove protected slices, relabel a regression,
  or fabricate an unmeasured metric to make a result pass.
- Keep `classification`, `invokeEvalGate`, and `releaseDecision` consistent with
  the canonical contract. Use `not_measured` with a reason when evidence does
  not exist.

## Verification

Run `npm test` after changing a skill, reference, schema, scenario, fixture, or
distribution manifest. The distribution validator, decision-contract tests,
and scenario scorer are release-blocking evidence.

