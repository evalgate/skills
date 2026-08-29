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

1. Inspect the repository and discover the installed runtime before choosing
   commands: `npx @evalgate/sdk capabilities --format json` and
   `npx @evalgate/sdk --help`. Then run
   `npx @evalgate/sdk understand --format json` (or the equivalent command
   advertised by the installed runtime) to preview product context. Treat
   inferred risks as hypotheses.
2. Read the canonical [authentication and credential handoff reference](../evaluate-ai-change/references/authentication-and-credential-handoff.md).
   Confirm a key is configured without printing it: `evalgate auth status`. If
   absent, use an RFC 8628 or JSON handoff only when the published runtime and
   docs advertise that exact flow, or ask an organization administrator for a
   least-privilege install key.
3. Before selecting an evaluation runner, inspect `package.json` scripts,
   `Makefile`/task files, CI workflows, and repository docs. Prefer the
   runtime-advertised handler and an existing project command. If a custom
   runner is required, record its exact argv, inputs, output artifact, network
   behavior, and owner; an unknown or ambiguous runner is **not configured**
   and must fail closed rather than being guessed into a baseline.
   When multiple supported package roots exist, compose one reviewed plan for
   the roots that own the behavior. If handlers conflict in the same directory,
   stop and require explicit selection (for example, the runtime's reviewed
   `--package-handler` override) instead of guessing which command to run.
4. Review the plan, then run `npx @evalgate/sdk init`. It is a
   preview and does not write files or run tests.
5. After a human approves the generated file list, apply with
   `npx @evalgate/sdk init --apply`.
6. Run the project’s evaluation command and accept a baseline only when
   evidence is non-empty and passing: `npx @evalgate/sdk baseline update`.
7. Run `npx @evalgate/sdk gate --format json` locally. Add the documented
   GitHub Actions workflow only after reviewing the diff.

## Expected artifacts

The reviewed setup normally produces `evalgate.config.json`, an evaluation directory, a baseline, and (when explicitly chosen) `.github/workflows/evalgate-gate.yml`. Report the exact files changed and the gate result.

## Safety boundary

Do not fabricate a baseline, upload source or traces, install packs, or change CI policy without explicit approval. Keep proprietary prompts, customer evidence, internal scoring rules, and private datasets in the customer repository; this workflow only describes the public CLI contract.

## Validation

Confirm that the selected command is advertised by the installed capability
map, `npx @evalgate/sdk gate --format json` exits successfully, the baseline is
non-empty, and generated files are inside the repository root. If the project
has no suitable evaluation command—or its custom runner cannot be identified
with a reproducible contract—report that limitation and leave setup incomplete
instead of claiming success.
