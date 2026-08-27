---
name: setup-evalgate-project
description: Set up a repository for its first EvalGate evaluation and regression gate. Use when a project has no reviewed EvalGate scaffold or needs a safe onboarding plan; do not use this to invent tests or apply changes without review.
---

# Set up an EvalGate project

## When to use

Use this when a repository needs a first evaluation workflow, a portable CI gate, or a clear local/cloud boundary. Repository scaffolding is account-anchored: obtain an organization-scoped install key before applying a local scaffold.

## Inputs

- Repository root and its existing test/evaluation commands.
- The behavior or release risk the team wants to measure.
- `EVALGATE_API_KEY` configured from an approved organization-scoped install key; never request or print the value in chat.

## Safe workflow

1. Inspect the repository and run `npx @evalgate/sdk understand --format json` (or `evalgate understand --format json`) to preview product context. Treat inferred risks as hypotheses.
2. Confirm a key is configured without printing it: `evalgate auth status`. If absent, use the RFC 8628 flow in the public `evaluate-ai-change` skill or ask an organization administrator for a least-privilege install key.
3. Review the plan, then run `npx @evalgate/sdk init --format json`. It is a preview and does not write files or run tests.
4. After a human approves the generated file list, apply with `npx @evalgate/sdk init --apply`.
5. Run the project’s evaluation command and accept a baseline only when evidence is non-empty and passing: `npx @evalgate/sdk baseline update`.
6. Run `npx @evalgate/sdk gate --format json` locally. Add the documented GitHub Actions workflow only after reviewing the diff.

## Expected artifacts

The reviewed setup normally produces `evalgate.config.json`, an evaluation directory, a baseline, and (when explicitly chosen) `.github/workflows/evalgate-gate.yml`. Report the exact files changed and the gate result.

## Safety boundary

Do not fabricate a baseline, upload source or traces, install packs, or change CI policy without explicit approval. Keep proprietary prompts, customer evidence, internal scoring rules, and private datasets in the customer repository; this workflow only describes the public CLI contract.

## Validation

Confirm that `npx @evalgate/sdk gate --format json` exits successfully, the baseline is non-empty, and the generated files are inside the repository root. If the project has no suitable evaluation command, report that limitation instead of claiming setup is complete.
