---
name: ask-repository-question
description: Ask an evidence-bounded question about a durably linked repository with EvalGate repository intelligence. Use when a scoped API key and an exact cloud-targetable commit are available; do not use this for unrestricted source extraction or speculative architecture claims.
---

# Ask a repository question

## When to use

Use this when an agent needs a concise answer grounded in a durably linked repository snapshot—for example, locating existing evaluations, agent frameworks, model providers, or test entry points. Prefer a specific question over a broad request to summarize private source.

## Inputs

- Connected repository identifier.
- Exact 40-character commit SHA to inspect.
- A focused question and an EvalGate API key. Reading repositories, existing
  scans, and answers needs `eval:read`. *Starting* a scan needs `eval:write`
  and organization membership, because it creates durable evidence (a scan
  run, a graph version, facts, source locators). If the commit has already
  been scanned, `eval:read` is enough to ask about it.
- `eval:write` is permission to write inside EvalGate. It is not GitHub
  repository-write access: this workflow never pushes, opens a pull request,
  or modifies the repository, and needs no in-repository scaffold.

## Safe workflow

1. Confirm the key is available without printing it: `evalgate auth status`.
2. List connected repositories: `evalgate repo repositories`.
3. Scan the exact cloud-targetable commit: `evalgate repo scan --repository <id> --head-sha <40-char-sha>`.
4. Review the scan evidence and graph version before asking a question: `evalgate repo ask --repository <id> --question "<focused question>"`.
5. Quote only the returned evidence references and mark source detection as detection, not proof of runtime behavior.
6. If the question would require secrets, customer data, execution, mutation, or a different commit, stop and ask for a narrower authorized request.

## Expected artifacts

Return the repository ID, commit SHA, graph/scan identity, answer, evidence references, uncertainty, and a suggested next local check. Keep source excerpts minimal and do not export a repository snapshot.

## When the honest answer is "nothing found"

A well-supported "no finding in the inspected scope" is a valid, complete
result. Never invent a defect, inflate a stylistic observation into a risk, or
describe a detection as a bug to make the answer feel more useful.

It is also not the end of the workflow. A clean read tells the team what is
currently unprotected, which is worth more than a manufactured finding.
Continue into whichever of these the evidence supports:

- **Name the coverage that exists.** Report the evaluations, tests, and gates
  the scan actually found for the inspected paths, with their evidence
  references. "Six AI call sites, three covered by an existing suite" is a
  finding.
- **Name the coverage that does not.** Behavior reachable in the scanned tree
  with no evaluation bound to it is an uncovered path, not a defect. Say which
  paths, and on what evidence.
- **Offer to protect what already works.** Correct current behavior with no
  regression coverage is the most common gap a clean scan exposes. Propose the
  smallest durable case that would fail if that behavior changed, and route to
  [setup-evalgate-project](../setup-evalgate-project/SKILL.md) or
  [run-regression-gate](../run-regression-gate/SKILL.md) only if the team
  wants it.
- **State what static inspection cannot settle.** Prompt quality, tool-call
  trajectories, latency, and cost are not visible in a source read. If the
  question needs them, say so and route to
  [collect-agent-traces](../collect-agent-traces/SKILL.md).

Keep the boundary intact throughout: a detection is a detection. Proposing
coverage for behavior the scan detected is not a claim that the behavior was
observed running, and an absence of findings is scoped to what was inspected,
never a statement that the repository is correct.

## Safety boundary

Repository intelligence reads one immutable source tree without executing it. It must not be represented as a production runtime confirmation, security review, or complete inventory. Do not ask the service to reveal private credentials, proprietary EvalGate internals, or unrelated customer evidence.

## Validation

Verify that the SHA is exactly 40 hexadecimal characters, the scan completed for that SHA, and every material claim has an evidence reference.

Check the scan's completeness before trusting a negative answer. A scan that
reports `partial` completeness, a truncated tree, a request-budget or
rate-limit stop, or any degradation reason has not finished looking — report
the omission and the reason code rather than presenting a scoped "nothing
found" as a conclusive one.

If no durable repository linkage or credential exists, report that prerequisite as
what it is — including the case where a read-only key can read prior evidence
but cannot start a new scan. The CLI returns a machine-readable envelope with an exit code and
recovery actions (`MISSING_API_KEY` exits 5); relay it instead of retrying,
and do not fall back to reading local source as though it were the connected
snapshot.
