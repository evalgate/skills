# Behavioral change detection

Use this reference when it is unclear whether a change requires EvalGate or how
widely to run coverage.

## Build an impact statement

Record:

- the observable behavior that may change;
- the component and execution path that owns it;
- affected users, tools, policies, and protected slices;
- the expected direction of change;
- existing evidence that covers it; and
- the consequence of a false pass or false block.

Source proximity alone is not enough. A shared serializer, timeout, permission,
cache, or routing change can affect AI behavior even when no prompt file changed.
Conversely, a documentation-only edit does not require an evaluation merely
because it mentions a model.

## Select scope

Start with impacted cases when the dependency boundary and baseline are clear.
Expand to the full suite when the change affects shared orchestration, routing,
schemas, safety policy, judge behavior, or an uncertain dependency boundary.
Include repeated trials when provider or agent variability can change the
decision. Preserve protected slices even when aggregate sampling is reduced.

Classify an unrelated change as `not_applicable` only after inspecting the real
execution path. Report the reason; do not run a ceremonial empty gate.
