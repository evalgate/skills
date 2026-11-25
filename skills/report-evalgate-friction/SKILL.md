---
name: report-evalgate-friction
description: Draft a short, redacted report when an EvalGate command, flag, report field, MCP tool or skill instruction contradicts what actually happened, or a step keeps failing in a way the failure-recovery table does not cover. Files it only with the person's approval. Not for bugs in the person's own code.
---

# Report EvalGate friction

A skill or the CLI can drift: a model upgrade, a changed flag, a renamed field.
When you notice it, a short structured report lets the owner fix it once
instead of every agent paying for the same workaround. Reporting never replaces
finishing the task; do it after the task is done or safely stopped.

## When to report

Report when one of these happened with EvalGate itself:

- a flag or command that a skill or `--help` lists is rejected;
- a report or envelope is missing a field a skill relies on, or a field means
  something else;
- an exit status, `code` or `failureClass` contradicts the report or the
  failure-recovery table;
- a documented MCP tool, scope or URL behaves differently from its skill;
- you spent three or more attempts on one EvalGate step that the
  failure-recovery table does not cover; or
- a skill instruction sent you the wrong way, and you can say what would have
  been right.

Do not report the person's own code failures, a regression the gate correctly
caught, a missing credential the person has not provided yet, or a question of
taste about wording.

## Workflow

1. Finish the task or stop it safely first. Note the exact step where things
   went wrong.
2. Check whether it is already known. If `gh` is available and signed in, run
   `gh issue list --repo evalgate/skills --label papercut --state all --search "<command or code>"`.
   If a matching issue exists, use its workaround for the rest of the session
   and offer to add a short comment instead of a new issue.
3. Draft the report using the fields below. Redact before showing it:
   no credentials, tokens, customer prompts or outputs, dataset rows, trace
   payloads, private repository paths or names, email addresses, or
   organization names. Keep envelope `code`, `failureClass`, `retryable`,
   versions and flag names; they are what the owner needs.
4. Show the draft to the person and ask: "Want me to file this with
   EvalGate?" The skills repository is public, so filing needs their yes.
5. With their yes and a signed-in `gh`, file it:
   `gh issue create --repo evalgate/skills --label papercut --title "<skill or command>: <what broke>" --body-file <draft file>`.
   Without `gh`, give them the draft and the link
   `https://github.com/evalgate/skills/issues/new?template=papercut.yml`.
6. Return to the person's work. Mention the report in one line at most.

## Report fields

```text
Skill and step:      <skill name>, <section or numbered step>
EvalGate versions:   SDK <version from status --json>; skills <commit or "unknown">
Agent and model:     <agent harness and model, if known>
What I ran:          <redacted command or MCP tool name>
What I expected:     <from the skill, help text or table>
What happened:       <code / failureClass / retryable / missing field / message summary>
Workaround used:     <what got past it, or "none">
Suggested fix:       <skill wording, table row, or CLI/SDK change>
Attempts and cost:   <number of attempts; rough turns or tokens spent, if known>
```

## Honesty

Only report what you observed in this session. Never invent a version, code or
reproduction. If you are unsure whether the fault is EvalGate's, say so in
"What happened" rather than guessing.
