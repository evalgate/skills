# Writing and revising rules

A rule is only as good as its wording. People correct answers in the moment,
often in shorthand or frustration, and a rule copied straight from that will
misfire. A weak rule is worse than none, because it keeps being applied. Check
every rule before keeping it, and expect to revise rules as the person's work
shows where they're too broad, too narrow or simply wrong.

## Check a rule before keeping it

A rule is ready to keep only if all of these hold:

| Check | Too weak | Ready |
| --- | --- | --- |
| Names the kind of work | "Always be more careful." | "For campaign summaries: …" |
| Says what to do, not how the person felt | "Stop being so dumb about numbers." | "Never invent a number the data doesn't show; say it's missing." |
| One idea | "Separate paid and organic, use bullet points, and be shorter." | Three rules, or only the one the person cares about |
| Someone else could check it | "Make it sound better." | "Lead with the conversion rate." |
| No "always" or "never" the person didn't say | "Never use tables." (they disliked one table) | "In weekly updates, prefer a short list over a table." |
| Doesn't fight a rule they already have | A new rule that reverses an old one | A revision of the old rule (below) |
| Nothing confidential in it | "Use account 4411-… for Acme." | "Use the account number from the Acme brief." |

If you can't make the rule pass, don't keep it. Say what you would need: "I'd
rather not save 'make it better'. What should be different next time?"

Read the person's correction for what they want, not their exact words.
Plain, blunt or angry phrasing is fine; turn it into a calm, specific rule and
show it to them before keeping it.

## Notice when a rule isn't working

A rule needs a second look when:

- the person corrects something the rule itself caused;
- they keep overriding it ("not this time" more than once for the same rule);
- it applied to work it wasn't meant for;
- they say it's wrong, or no longer how they work.

Then offer once, in their words: "Your rule about tables keeps getting in the
way. Want me to change it, narrow it, or drop it?"

## Revise, don't stack

Change the existing rule rather than adding a second one that contradicts it.
Show the old and new wording side by side and keep the new one only with the
person's agreement.

- **On its own:** replace the old rule wherever you kept it, and say where it
  is now. If you can't edit that place yourself, give them the new line and
  tell them which old line to remove.
- **With EvalGate connected:** record the correction that showed the problem
  with `quality_correction_capture`, then call `quality_standard_propose` with
  the **same** `semanticKey` and `scope` as the rule being changed (it comes
  back from `quality_standards_resolve`) and the new `statement`. That makes a
  new version of the same rule. The old version keeps applying until the new
  one is approved, and approving the new one replaces it. A new
  `semanticKey` would create a second, competing rule instead.
- **To drop a rule:** remove it where you kept it, or, with EvalGate connected,
  tell them they can delete their own personal rule in EvalGate.

Never change or drop a rule without telling the person, and never keep two
versions of the same rule active.
