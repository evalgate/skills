# Red-team and framework-control work

Use this reference only for red-team campaigns, attack findings, or mapping
evidence to a framework or control.

## Where it runs

In the published capability map, red-team is a cloud capability at the
`/red-team` workspace. The documented CLI/API discovery entry is:

```bash
npx @evalgate/sdk api get_red_team_workspace --format json
```

Campaign, run, finding, promotion, and signed-report operations are exposed by
the contract that call returns, not by an invented local command. Use them only
when the installed contract advertises them and the caller has a scoped
credential for the step.

## Evidence rules

1. Keep attack evidence and benign utility evidence distinct. A model that
   refuses everything passes attacks and fails users.
2. Treat missing observations or a provider failure as incomplete evidence, not
   a passing control result.
3. A framework or control reference records provenance and a reviewed mapping
   rationale. It does not prove implementation, compliance, certification,
   endorsement, partnership, or affiliation.
4. Report each finding with its campaign, run, case and revision identifiers so
   a reviewer can reproduce it.
