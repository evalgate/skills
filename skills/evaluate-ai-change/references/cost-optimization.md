# Cost and latency optimization

Use this reference when an agent, Skill, harness, judge, or candidate may be
wasteful.

Inspect evidence for redundant context, repeated discovery, unnecessary tool
calls or retries, avoidable frontier-model use, poor caching, excessive judge
coverage, long explanations, and reasoning that deterministic logic can replace.

Compare quality, protected slices, reliability, latency, token use, tool calls,
and cost together. Prefer a Pareto improvement. When quality improves while cost
or latency materially worsens, surface the tradeoff and apply the team's policy;
do not automatically promote or reject it. Never optimize cost below required
quality, safety, or reliability.

Keep optimization recommendations bounded to observed evidence. Do not expose
prompts, customer content, or proprietary evaluation thresholds in a public
report.
