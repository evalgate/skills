# Evaluation authoring

Use this reference when the change or a discovered failure lacks durable
coverage.

Prefer the repository's existing EvalGate configuration, datasets, test-case
schema, scorers, and review flow. Begin with an observed interaction, explicit
requirement, or reproducible failure—not a fabricated ideal answer.

For each proposed case, preserve:

- the behavior or risk being tested;
- source evidence and provenance;
- inputs and allowed variability;
- assertions or scorer rationale;
- relevant slice labels;
- whether model-backed execution is required; and
- review state.

Quarantine generated or synthetic candidates until review. A new regression
case should fail against the known-bad behavior and pass after the implementation
fix. Avoid exact-string assertions when the behavioral contract allows multiple
valid outputs. Do not edit historical results or silently replace the reviewed
baseline.

Use `npx @evalgate/sdk capabilities --format json` and current CLI help to find
the supported authoring path. Do not invent a command, endpoint, or schema.
