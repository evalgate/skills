---
name: run-regression-gate
description: Run and interpret an EvalGate regression gate before a release or pull request. Use when evaluation files and a reviewed baseline already exist; do not use this to silently update the baseline or weaken thresholds.
---

# Run a regression gate

## When to use

Reach for this skill before shipping a change to an AI behavior, prompt, tool policy, or evaluation harness. It is for comparing current evidence with a reviewed baseline, not for replacing a failing result with a new baseline.

## Inputs

- Repository root containing `evalgate.config.json` and a reviewed baseline.
- The change or commit being evaluated.
- Optional base ref for a pull-request comparison.

## Safe workflow

1. Discover the intended suite and write its machine-readable manifest with `npx @evalgate/sdk discover --manifest` (or `evalgate discover --manifest`).
2. Run `npx @evalgate/sdk gate --format json`. For CI, use `npx @evalgate/sdk ci --format github --write-results` and upload only the documented `.evalgate/` artifacts.
3. Interpret stable exit codes: `0` passes, `1` score threshold, `2` regression, `3` policy violation, `6` insufficient sample, `7` weak evidence, and `10` untrusted judge credibility. Preserve the machine-readable report.
4. For a failure, run `npx @evalgate/sdk explain --format json` and inspect the evidence-linked case or failure mode before changing code.
5. If behavior intentionally changed, stop and ask for explicit baseline review. Only then run `npx @evalgate/sdk baseline update`; never run it automatically as failure recovery.

## Expected artifacts

Produce a gate report, exit code, evaluated commit or working tree identity, and a concise next action. In CI, retain the generated results without including credentials, raw customer data, or unredacted prompts.

## Safety boundary

Do not lower thresholds, delete failing cases, retry until green, mutate release configuration, or upload failed context to the hosted platform without an explicit operator choice. Probabilistic checks need the configured repetition and pass-rate evidence; one lucky retry is not a pass.

## Validation

Verify the command used the intended repository root and baseline, the report contains case-level outcomes, and a non-zero exit code is surfaced to CI. A passing command with zero discovered cases is not sufficient evidence.
