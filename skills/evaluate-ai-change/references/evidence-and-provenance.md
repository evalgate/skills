# Evidence and provenance

Use this reference when creating coverage, comparing variants, or handing off a
release decision.

Preserve:

- repository revision and dirty-tree state;
- EvalGate configuration, suite, baseline, and policy identities;
- dataset and protected-slice identities;
- candidate, prompt, model, provider, tool, harness, and Skill versions;
- commands, exit codes, case counts, trials, and timestamps;
- evidence/report identifiers and failure classification;
- approved mutations and reviewer rationale; and
- untested or unavailable boundaries.

Do not mutate historical evidence, discard inconvenient trials, or replace a
failed run with a successful retry. Create a new attributable run. Keep secrets,
raw customer content, and unnecessary source excerpts out of public artifacts.

For the failure-to-eval loop, link the observed failure to the proposed case,
the known-bad detection run, implementation fix, passing rerun, and reviewer.
