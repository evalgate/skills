# Host and availability limits

This skill is a set of instructions for an assistant. It is not a background
listener: it cannot read every conversation, change the assistant's built-in
instructions, or apply rules in a conversation where the assistant doesn't call
EvalGate. Say only what the current assistant actually did.

## What each assistant can do

| Assistant | How EvalGate is reached | What to expect |
| --- | --- | --- |
| Microsoft 365 Copilot Chat | An organization plugin that combines this skill with the EvalGate connection | Works when Copilot selects the skill or tool for a task. Automatic selection can be configured but is not guaranteed for every task. An administrator may need to approve the install. |
| ChatGPT | An app built on the EvalGate connection, where available for the plan | The app receives the context ChatGPT passes when it is invoked, not every chat. |
| Claude | The EvalGate connection added to Claude, plus this skill | Works when Claude calls the tools; the skill does not run on its own. |

Microsoft 365 Copilot Chat (workplace), GitHub Copilot (developers) and the
consumer Microsoft Copilot app are different products. Support in one is not
support in the others.

None of these assistants has been verified end to end with EvalGate yet. Until
a specific assistant is verified, describe EvalGate as "available when the
assistant uses it", not "works in every conversation".

## Workspace availability

The tools this skill uses belong to EvalGate's portable quality capability,
which is in pilot and not publicly released. The EvalGate connection lists them
only for workspaces where an administrator has enabled the pilot, and only to
people with the needed permissions:

- `quality_standards_resolve` needs permission to read rules (`standards:read`).
- `quality_correction_capture` needs permission to save corrections
  (`standards:write`, `contexts:write`, `resources:write`,
  `observations:write`), and member access.
- `quality_standard_propose` needs `standards:write` and member access.

If the tools are not listed, EvalGate is not available to this person here.
Say so once and continue without it.

## What EvalGate keeps

- The request, the answer the person corrected, and the correction itself.
- Only a fingerprint (SHA-256) and size of the material the answer was based
  on, never its text.
- Each correction belongs to the person who made it, in their organization.
  Another person cannot build a rule from it unless the work was shared with
  the organization.
- A proposed rule does nothing until it is approved in EvalGate.
