---
name: setup-evalgate-project
description: Set up a repository for its first EvalGate evaluation and regression gate. Use when a project has no reviewed EvalGate scaffold or needs a safe onboarding plan; do not use this to invent tests or apply changes without review.
---

# Set up an EvalGate project

## When to use

Use this when a repository needs durable evaluation coverage: a first
evaluation workflow, a portable CI gate, or an accepted baseline to gate
against.

Do not use it merely to answer a question about a repository. A connected
repository with a read scope can reach evidence-linked understanding with no
scaffold and no write access — see
[ask-repository-question](../ask-repository-question/SKILL.md). Scaffolding is
the step that follows a decision to measure something, not the price of
looking.

## Credential boundary

`evalgate init --local` is credential-free. It writes no hosted state, needs
no organization-scoped key, and makes no network call; the published runtime
reports `networkAndCredentials.initApply: "none"` for this path. Use it for
local, offline, sandboxed, or restricted-network work, and when a team wants
a reviewed scaffold before deciding on hosted linkage.

A credential is required only to attach that work to hosted state — `evalgate
login` for an attributable human session, `evalgate link` for repository
linkage, and any cloud evidence or repository-intelligence call. Do not
request a key for a local scaffold, and never request or print its value in
chat.

## Inputs

- Repository root and its existing test/evaluation commands.
- The behavior or release risk the team wants to measure.
- For hosted linkage only: `EVALGATE_API_KEY` from an approved
  organization-scoped install key, or an `evalgate login` session.

## Safe workflow

1. Inspect the repository and discover the installed runtime before choosing
   commands: `npx @evalgate/sdk capabilities --format json` and
   `npx @evalgate/sdk --help`. Then run
   `npx @evalgate/sdk understand --format json` (or the equivalent command
   advertised by the installed runtime) to preview product context. Treat
   inferred risks as hypotheses.
2. Decide whether this run needs hosted state at all. A local scaffold does
   not: skip to step 3 and use `--local`. If the team wants hosted linkage or
   cloud evidence, read the canonical
   [authentication and credential handoff reference](../evaluate-ai-change/references/authentication-and-credential-handoff.md),
   then confirm a credential without printing it: `evalgate auth status`. If
   absent, use an RFC 8628 or JSON handoff only when the published runtime and
   docs advertise that exact flow, or ask an organization administrator for a
   least-privilege install key. A missing credential must never be worked
   around by weakening the scaffold or inventing an anonymous identity.
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
4. Review the plan, then run `npx @evalgate/sdk init --local` (or
   `npx @evalgate/sdk init` when hosted linkage is already established). Both
   are previews: they write no files and run no tests.
5. After a human approves the generated file list, apply with `--apply`
   (for example `npx @evalgate/sdk init --local --apply`). In a terminal init
   asks before writing; automation stays preview-only unless `--apply` is
   passed explicitly.
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
