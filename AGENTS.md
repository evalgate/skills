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
   task; do not load every skill by default. `everyday/everyday-ai` is the
   separately installed persona for nontechnical assistants.
5. When a command fails, use the bundled `references/failure-recovery.md`
   table. If EvalGate contradicts a skill, use `report-evalgate-friction`.

## Safety and product boundaries

- Never add customer prompts, datasets, traces, credentials, private repository
  content, or proprietary EvalGate scoring logic to this public repository.
- MCP product access is scope-filtered: read evidence without mutation; create
  evaluations, test cases, runs or traces only when the current authenticated
  caller has the required write scope/role and explicitly approves the effect.
  The documentation MCP remains anonymous and public-content-only.
- Use `skills/use-evalgate-mcp/references/scoped-authoring.md` for supported
  write names, admin-only connector mutations and unshipped quality operations.
- Product operations require an attributable organization-scoped credential;
  a Skill installation or public schema discovery does not issue one.
- Do not weaken a release gate, remove protected slices, relabel a regression,
  or fabricate an unmeasured metric to make a result pass.
- Keep `classification`, `invokeEvalGate`, and `releaseDecision` consistent with
  the canonical contract. Use `not_measured` with a reason when evidence does
  not exist.

## Verification

Run `npm test` after changing a skill, reference, schema, scenario, fixture, or
distribution manifest. The distribution validator, skill linter, decision-
contract tests, case validation and scorers are release-blocking evidence.

When you change a skill:

- update its `specs/<skill>.spec.json` if the goal, commands or outputs change;
- keep or extend its cases in `evaluations/skills/<skill>.cases.jsonl`;
- edit shared references in `skills/evaluate-ai-change/` and run
  `node scripts/check-standalone.mjs --sync`;
- if you add or remove a workaround for SDK behavior, update
  `evaluations/sdk-papercuts.json`;
- claim a behavioral improvement only from a live with/without run whose
  difference exceeds the noise band.

