# External imports and governed improvement

Discover the installed commands before selecting flags or hosted operations:

```bash
npx @evalgate/sdk capabilities --format json
npx @evalgate/sdk improve --help
```

## Inspect an external result

Some published runtimes do not advertise `import`; development runtimes
may expose it. The verified inventory is in the runtime truth ledger. First inspect the runtime capability map. If `import`
is absent, report the unsupported local intake boundary and preserve the artifact;
do not claim inspection occurred or guess a hosted import route. Only when
advertised, discover `import --help` via the canonical CLI and use
`import inspect <file> --format json` for a supported
external optimization artifact. The current command is local and read-only;
it recomputes observations and reports missing evidence. Unsupported or
malformed input is a refused import, not a product regression. A successful
process exit means an assessment was produced, not that a change passed.

Preserve source identity, format, observed cases, evaluator provenance,
recomputed scores, missing measurements, and the candidate binding. Treat
imported claims as investigation-only. To qualify or bind the result to hosted
release review, discover the current API operation and scopes; do not invent
`import qualify` or assume local inspection uploads or promotes anything.
Require an exact candidate/repository binding and governed evidence before
recommending a release. If those are missing, report inconclusive readiness.

## Inspect an improvement cycle

Read-only discovery can include:

```bash
npx @evalgate/sdk improve cycles --format json
npx @evalgate/sdk improve inspect --cycle <id> --format json
npx @evalgate/sdk improve candidates --cycle <id> --format json
npx @evalgate/sdk improve partitions --cycle <id> --format json
npx @evalgate/sdk improve confirmation --cycle <id> --action lineage --format json
```

Hosted inspection needs an attributable scoped credential. Read scope does not
authorize a run, candidate adoption, partition changes, or traffic movement.
Use installed help and API scope metadata as authority for the actual operation.

For an authorized improvement run, discover `improve run` inputs, budget,
autonomy, candidate identity, experiment policy, and sandbox boundary first.
Retain protected regression evidence alongside remediation progress. An
aggregate improvement or a successful dispatch is not an accepted candidate.

## Confirm a frozen candidate

Inspect confirmation lineage and eligibility before dispatching
`improve confirmation --cycle <id> --candidate <id> --action run`. Run only when the user has
authorized execution and the runtime confirms a frozen candidate plus eligible
confirmation evidence. This action dispatches `confirmation_only` trials;
`improve run` is a different workflow and is not interchangeable.

Keep selection and confirmation roles separate. Evidence exposed to selection,
including multi-arm comparisons, cannot become independent confirmation by
renaming it. Missing freeze, eligible partition, support, observations, or
candidate identity leaves readiness blocked or inconclusive. Discover and
review add/prepare/reserve mutations separately; never rotate evidence to
erase inconvenient results.

Inspect the resulting canonical decision and completeness, policy identity,
protected slices, provider admission, attributable cost, and latency. Report
unmeasured cost as `not_measured`; do not invent a price or claim cost
non-inferiority without valid evidence. Adoption is a human decision record,
not a live-traffic promotion. Do not invent shadow, canary, promote, or rollback
CLI actions when the installed help does not advertise them.
