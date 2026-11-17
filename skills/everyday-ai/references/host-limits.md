# Roles and limits

This skill is a set of instructions for an assistant. It is not a background
listener: it cannot read every conversation, change the assistant's built-in
instructions, or apply rules in a conversation where the assistant doesn't use
it. Say only what the current assistant actually did.

## Who decides what

Several different people can be called an "administrator". They are not the
same person, and being one does not make someone the others.

| Who | What they decide | What they don't decide |
| --- | --- | --- |
| The person | What gets kept, the wording of their rules, and removing their own rules | Their team's rules |
| Their assistant's administrator (Microsoft 365 tenant admin, ChatGPT workspace admin, Claude organization owner; for a personal account, the person) | Whether the skill and the EvalGate connection can be installed in that assistant | Anything inside EvalGate |
| An EvalGate workspace owner or administrator | Rules for the whole workspace, and removing any rule there as a safety control | Another person's personal rules, which they can't approve or edit |
| An EvalGate workspace member | Saving corrections, suggesting rules, and approving or removing their own personal rules | Shared rules |
| An EvalGate workspace viewer | Reading the rules that apply to them | Saving anything |
| EvalGate, the company | Whether the capability is released at all | Anything in a customer's workspace |

An EvalGate workspace is either the person's own (they own it) or their
team's (someone else usually owns it). The assistant's connection is tied to
one workspace. Someone who runs their own assistant can still be an ordinary
member of their team's EvalGate workspace.

## On its own versus connected

| | On its own (default) | With EvalGate connected |
| --- | --- | --- |
| Setup needed | None | The assistant's admin installs the connection; the person signs in to an EvalGate workspace |
| Where rules live | The assistant's own memory or instructions, or a note the person keeps | The person's EvalGate workspace |
| Rules follow the person between assistants | No | Yes, wherever that workspace is connected |
| Team rules | No | Yes, decided by the workspace's administrators |

## What each assistant can do

| Assistant | How EvalGate is reached | What to expect |
| --- | --- | --- |
| Microsoft 365 Copilot Chat | An organization plugin that combines this skill with the EvalGate connection | Works when Copilot selects the skill or tool for a task. Automatic selection can be configured but is not guaranteed for every task. The tenant admin may need to approve the install. |
| ChatGPT | An app built on the EvalGate connection, where available for the plan | The app receives the context ChatGPT passes when it is invoked, not every chat. |
| Claude | The EvalGate connection added to Claude, plus this skill | Works when Claude calls the tools; the skill does not run on its own. |

Microsoft 365 Copilot Chat (workplace), GitHub Copilot (developers) and the
consumer Microsoft Copilot app are different products. Support in one is not
support in the others.

None of these assistants has been verified end to end with EvalGate yet. Until
a specific assistant is verified, describe EvalGate as "available when the
assistant uses it", not "works in every conversation".

## Release status

The EvalGate tools this skill uses are in pilot and not publicly released.
EvalGate releases them for everyone at once; a workspace administrator cannot
switch them on. Once released, the connection lists them only to people with
the needed permissions:

- `quality_standards_resolve` needs permission to read rules (`standards:read`).
- `quality_correction_capture` needs permission to save corrections
  (`standards:write`, `contexts:write`, `resources:write`,
  `observations:write`), and member access.
- `quality_standard_propose` needs `standards:write` and member access.

If the tools are not listed, use the skill on its own. Don't tell the person
they are missing anything.

Known gaps during the pilot:

- A suggested rule can be approved only after a check for it is set up in
  EvalGate, so a rule suggested from a conversation stays a suggestion until
  then. Keep it on its own meanwhile.
- EvalGate has no simple screen yet for a person to list and remove their own
  rules.

## What EvalGate keeps

- The request, the answer the person corrected, and the correction itself.
- Only a fingerprint (SHA-256) and size of the material the answer was based
  on, never its text.
- Each correction belongs to the person who made it, in that workspace.
  Another person cannot build a rule from it unless the work was shared with
  the workspace.
- A suggested rule does nothing until it is approved in EvalGate.
