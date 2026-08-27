# Release gates

Use this reference before recommending merge, promotion, or baseline movement.

A release decision requires non-empty evidence from the intended revision,
suite, baseline, environment, and policy. Preserve the machine-readable report
and command exit status. Treat warning bands, insufficient samples, weak
evidence, failure-mode thresholds, judge credibility, I/O failures, and
baseline-integrity failures according to the configured policy—not as success.

Do not:

- lower a threshold or remove a case to obtain green;
- accept a new baseline as failure recovery;
- retry until a favorable probabilistic result appears;
- bypass CI or omit a failed slice from the report; or
- claim that a local deterministic run exercised hosted/model-backed behavior.

An intentional behavior change can justify a reviewed baseline update only when
the new contract, affected evidence, approver, and rationale are explicit.
Otherwise fix the candidate and rerun the affected scope.
