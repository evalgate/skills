# Troubleshooting and invalid evidence

Use this reference when EvalGate cannot produce a valid behavioral conclusion.

Classify the blocking condition precisely:

- missing or ambiguous project/configuration;
- zero discovered or eligible cases;
- absent reviewed baseline;
- missing credential or insufficient scope;
- provider, API, network, or model-gateway failure;
- runner crash, timeout, cancellation, or malformed output;
- unavailable dataset or trace evidence;
- weak samples, judge disagreement, or untrusted judge evidence; or
- baseline-integrity or artifact I/O failure.

Use `npx @evalgate/sdk doctor --quick`,
`npx @evalgate/sdk capabilities --format json`, and the current command's
`--help` output to identify a supported recovery path. Do not use undocumented
routes, escalate scopes automatically, or retry indefinitely.

An invalid run is neither a pass nor a product regression. Report what failed,
what evidence is missing, whether deterministic coverage remains valid, and the
smallest operator action needed to resume.
