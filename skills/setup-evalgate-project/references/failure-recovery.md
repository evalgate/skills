# Failure recovery

Use this table when an EvalGate command fails, a report blocks, or the workflow
cannot produce valid evidence. Find the signal in the machine output
(`--format json` or `--json`), not in human text or the process exit number.
Exit numbers are overloaded; the envelope's `code`, `failureClass` and
`retryable` fields are the authority.

"Try again" is never a fix on its own. The CLI already retries retryable
transport failures with a bounded budget before it reports them, so an agent
retry loop only adds cost.

## CLI envelope failures

| Signal | What it means | Do this | Never |
| --- | --- | --- | --- |
| `failureClass: validation`, `BAD_ARGS`, `INVALID_*` | A flag, argument or input file is wrong | Read that one command's `--help`, fix the arguments once, rerun | Guess another flag spelling in a loop |
| `MISSING_API_KEY` | The hosted step has no credential | Ask the person to run `npx @evalgate/sdk login`, or to set `EVALGATE_API_KEY` from an approved key; for local work use the local path instead | Ask for the key in chat, print it, or invent an identity |
| `failureClass: auth_denied` (401) | The credential is invalid or expired | Ask the person to sign in again or obtain a new key | Retry with the same credential |
| `failureClass: insufficient_scope` (403) | The credential lacks the scope or role for this step | Name the exact scope the step needs (see the credential handoff reference) and ask an administrator | Retry, or request a broader key than the step needs |
| `code: human_action_required` (legacy `GITHUB_ACCESS_REQUIRED`) | A person must open a URL, such as a GitHub App install | Give the person the URL from the envelope and wait for them | Poll or retry until it works |
| `GITHUB_INSTALL_UNAVAILABLE` | The operator has not configured the GitHub App | Report it as an operator configuration problem and stop | Retry |
| `NO_ORG_MEMBERSHIP`, `ORGANIZATION_CLOSED` | The identity is not in an active organization | Report it; the person resolves membership | Switch to another organization's evidence |
| `failureClass: not_found` | The repository, run or commit ID does not exist for this caller | List the real IDs (for example `npx @evalgate/sdk repo repositories`) and confirm the exact one | Substitute a different repository or commit |
| `failureClass: rate_limited`, `network`, `outage` with `retryable: true` | Transient infrastructure failure that survived the CLI's own retries | Report it with the envelope; rerun at most once later, with the person's agreement | Loop, or report the step as passed |
| `QUOTA_EXCEEDED`, `FEATURE_LIMIT_REACHED` | The plan limit is reached | Report it; the person decides on the plan | Work around the limit with another account |
| `failureClass: cancelled` | A person or orchestrator stopped the command | Stop and report what completed | Restart without being asked |
| `failureClass: unknown`, or an exit the report does not explain | Unclassified failure | Classify the result `infrastructure_failure` or `inconclusive` and keep the raw-safe envelope | Treat an unknown value as a pass |
| Malformed or missing JSON output | The run cannot be tied to the evaluated revision | Classify `infrastructure_failure`; leave release readiness inconclusive | Fall back to human text or an optimistic exit reading |

## Gate, baseline and evidence codes

| Signal | What it means | Do this | Never |
| --- | --- | --- | --- |
| `BASELINE_MISSING` | No reviewed baseline exists | Route to setup: preview `npx @evalgate/sdk init --local`, apply only after approval | Create a baseline to make the gate pass |
| `BASELINE_NOT_ACCEPTED` | A run may pass, but no reviewed baseline was accepted | Ask the owner to review and accept one | Accept it yourself as failure recovery |
| `BASELINE_TAMPER` | The baseline checksum does not match | Stop and report; the owner investigates | Regenerate or overwrite the baseline |
| `BASELINE_DIRTY_WORKTREE` | Uncommitted changes would enter the baseline | Ask the person to commit or set the changes aside | Stash or discard their changes for them |
| `BASELINE_NO_EXECUTED_TESTS`, eligible count 0 | Nothing was evaluated | Fix discovery with `npx @evalgate/sdk discover --manifest` and confirm the suite | Report zero cases as a pass |
| `BASELINE_TEST_RUNNER_FAILED`, `BASELINE_TEST_SUITE_FAILED` | The project's own runner or tests failed | Fix the runner or the failing tests first | Accept a baseline over failing evidence |
| `MANIFEST_INVALID` | The discovery manifest is stale or malformed | Regenerate it with `discover --manifest` | Hand-edit it to pass validation |
| `PACKAGE_HANDLER_CONFLICT` | Two handlers claim the same directory | Ask which handler owns the behavior, then pass the reviewed `--package-handler` override | Pick one silently |
| `COVERAGE_NOT_REGISTERED` | The behavior has no registered coverage | Propose the smallest durable case (see eval authoring) | Report the behavior as covered |
| `trajectory_evidence_missing` | An active golden trajectory case has no complete observation | Record observations for every active case in `.evalgate/golden/observations.jsonl`, then rerun | Pass the case on final-answer equality |
| `PROVIDER_UNAVAILABLE`, `provider_unavailable`, `PROVIDER_INCONCLUSIVE` | Required provider evidence is missing, stale or deferred | Treat as infrastructure evidence; read the provider and cache reference | Substitute another provider or model silently, or call deferred a pass |
| `PROVIDER_KEY_MISSING`, `PROVIDER_UNAUTHORIZED` | `--allow-network` needs a provider credential the operator has not supplied | Ask the operator, or run the offline gate if it answers the question | Paste a personal key into config |
| `LOW_N`, `WEAK_EVIDENCE` | Too few cases or trials to decide | Add cases or trials; report `inconclusive` until then | Promote on the thin result |
| `JUDGE_CREDIBILITY_UNTRUSTWORTHY` | The judge is too weak to trust for this decision | Report the judge result as untrusted evidence | Use judge agreement as proof of correctness |
| `WARN_REGRESSION` | The drop is inside the warning band | Report it; the owner decides | Hide it because the gate exited cleanly |
| `REGRESSION`, `SCORE_BELOW`, `POLICY_VIOLATION`, `FAILURE_MODE_THRESHOLD` | A real gate failure | Run `npx @evalgate/sdk explain --format json`, fix the implementation, rerun the affected scope | Lower thresholds, delete cases, or move the baseline |
| `IO_ERROR` | A report, baseline or trace could not be written | Fix the path or permission and rerun once | Treat the unwritten report as evidence |

## Hosted MCP failures

| Signal | Do this | Never |
| --- | --- | --- |
| `401` on the product server | The caller is anonymous or expired; configure a credential through the client's secret store | Claim the server is connected |
| `403` or a tool missing from the caller's `tools/list` | The role or scope does not allow it; report the missing scope | Call a similarly named tool instead |
| A write returns `accepted` but no readback | Report `accepted`, not `persisted` or `completed` | Report the effect as done |

## When this table or the skill is wrong

If the CLI contradicts a skill instruction or this table (a flag the help lists
is rejected, a command is missing, a report field is absent, a code is not
here), finish or stop the task safely, then draft a friction report with
[report-evalgate-friction](https://github.com/evalgate/skills/blob/main/skills/report-evalgate-friction/SKILL.md).
