---
name: ask-repository-question
description: Ask an evidence-bounded question about a connected repository with EvalGate repository intelligence. Use when a scoped API key and an immutable commit are available; do not use this for unrestricted source extraction or speculative architecture claims.
---

# Ask a repository question

## When to use

Use this when an agent needs a concise answer grounded in a connected repository snapshot—for example, locating existing evaluations, agent frameworks, model providers, or test entry points. Prefer a specific question over a broad request to summarize private source.

## Inputs

- Connected repository identifier.
- Exact 40-character commit SHA to inspect.
- A focused question and an API key with the documented repository-intelligence read scopes.

## Safe workflow

1. Confirm the key is available without printing it: `evalgate auth status`.
2. List connected repositories: `evalgate repo repositories`.
3. Scan the exact immutable commit: `evalgate repo scan --repository <id> --head-sha <40-char-sha>`.
4. Review the scan evidence and graph version before asking a question: `evalgate repo ask --repository <id> --question "<focused question>"`.
5. Quote only the returned evidence references and mark source detection as detection, not proof of runtime behavior.
6. If the question would require secrets, customer data, execution, mutation, or a different commit, stop and ask for a narrower authorized request.

## Expected artifacts

Return the repository ID, commit SHA, graph/scan identity, answer, evidence references, uncertainty, and a suggested next local check. Keep source excerpts minimal and do not export a repository snapshot.

## Safety boundary

Repository intelligence reads one immutable source tree without executing it. It must not be represented as a production runtime confirmation, security review, or complete inventory. Do not ask the service to reveal private credentials, proprietary EvalGate internals, or unrelated customer evidence.

## Validation

Verify that the SHA is exactly 40 hexadecimal characters, the scan completed for that SHA, and every material claim has an evidence reference. If no connected repository or key exists, report the onboarding prerequisite.
