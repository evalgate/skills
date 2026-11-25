// Exercises the live paths of both harnesses against a local mock of the
// OpenAI chat API, so CI covers ablation arms, trials, progressive loading
// and trajectory capture without credentials or network.
//
// When EVALGATE_SDK_CLI points at an installed @evalgate/sdk CLI, the skill
// tests are also scored by `skill test --observations` and the trigger and
// uplift numbers are asserted. Without it, SDK scoring is skipped explicitly
// (EVALGATE_SDK_DISABLE=1): this test never downloads anything from npm.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
// "deliberate": the without arm answers badly on every scenario.
// "coinflip": the without arm answers well except on one scenario, the case a
//   noise band over all scenarios used to call significant.
// "http500": every provider call fails.
let mockMode = "deliberate";
const fixtures = new Map(
	readFileSync(resolve(root, "evaluations/fixtures/passing-results.jsonl"), "utf8")
		.trim()
		.split(/\r?\n/u)
		.map((line) => JSON.parse(line))
		.map((row) => [row.scenarioId, row]),
);
const firstScenarioId = [...fixtures.keys()][0];

// A deterministic "agent": it loads a skill when the catalog offers the one it
// wants, reads one reference, then answers. Without the skill it answers
// badly, so the paired comparison has a known direction.
function reply(body) {
	const system = body.messages[0].content;
	const turns = body.messages.slice(1);
	const user = turns[0].content;
	const loaded = turns.filter((m) => m.role === "user" && m.content.startsWith("SKILL ")).length;
	const read = turns.filter((m) => m.role === "user" && m.content.startsWith("FILE ")).length;
	const decisionMode = system.includes("Output schema:");
	if (decisionMode) {
		const scenarioId = user.match(/scenarioId exactly as ([^.\s]+)\./u)?.[1];
		const offersSkill = system.includes("- evaluate-ai-change:");
		if (offersSkill && loaded === 0) return { load: "evaluate-ai-change" };
		if (offersSkill && read === 0) return { read: "evaluate-ai-change/references/decision-contract.md" };
		const good = fixtures.get(scenarioId);
		if (offersSkill) return { final: good };
		if (mockMode === "coinflip" && scenarioId !== firstScenarioId) return { final: good };
		return { final: { ...good, classification: "inconclusive", releaseDecision: "investigate", invokeEvalGate: true } };
	}
	const offersGate = system.includes("- run-regression-gate:");
	const wantsGate = /gate|baseline|regression|release|promote|eligible|trajectory|provider|stack trace/iu.test(user);
	if (offersGate && wantsGate && loaded === 0) return { load: "run-regression-gate" };
	if (offersGate && wantsGate && read === 0) return { read: "run-regression-gate/references/failure-recovery.md" };
	if (loaded > 0) {
		return {
			final: {
				route: "run-regression-gate",
				actions: ["run_gate", "explain_failure", "fix_implementation", "rerun_affected_scope", "stop_for_baseline_review", "report_not_release_ready", "verify_trajectory_observations", "mark_infrastructure_failure", "configure_ci_gate", "ask_approval"],
				commands: ["npx @evalgate/sdk status --json", "npx @evalgate/sdk discover --manifest", "npx @evalgate/sdk gate --format json", "npx @evalgate/sdk explain --format json", "npx @evalgate/sdk ci --format github --write-results"],
				stop: null,
				reply: "Mock answer.",
			},
		};
	}
	return { final: { route: "none", actions: ["no_evalgate_needed"], commands: [], stop: null, reply: "Mock answer without the skill." } };
}

const server = createServer((request, response) => {
	let raw = "";
	request.on("data", (chunk) => (raw += chunk));
	request.on("end", () => {
		if (mockMode === "http500") {
			response.statusCode = 500;
			response.end(JSON.stringify({ error: "mock outage" }));
			return;
		}
		const body = JSON.parse(raw);
		const content = JSON.stringify(reply(body));
		response.setHeader("content-type", "application/json");
		response.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: Math.ceil(body.messages.map((m) => m.content).join("").length / 4), completion_tokens: 50 } }));
	});
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const env = {
	...process.env,
	OPENAI_API_KEY: "mock-key",
	OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}`,
	...(process.env.EVALGATE_SDK_CLI ? {} : { EVALGATE_SDK_DISABLE: "1" }),
};

function run(args, extraEnv = {}) {
	return new Promise((done) => {
		const child = spawn(process.execPath, args, { cwd: root, env: { ...env, ...extraEnv } });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk));
		child.stderr.on("data", (chunk) => (stderr += chunk));
		child.on("close", (status) => done({ status, stdout, stderr }));
	});
}

const out = mkdtempSync(join(tmpdir(), "evalgate-live-contract-"));
try {
	// Primary harness: both arms, two trials, progressive loading.
	const harness = await run(["scripts/evaluate-ai-change-harness.mjs", "--mode", "live", "--provider", "openai", "--model", "mock", "--arm", "both", "--trials", "2"]);
	assert.equal(harness.status, 0, harness.stderr || harness.stdout.slice(0, 500));
	const report = JSON.parse(harness.stdout);
	assert.equal(report.executed, true);
	assert.equal(report.loading, "progressive");
	assert.deepEqual(report.armsRun, ["with", "without"]);
	assert.equal(report.arms.with.trials, 2);
	assert.equal(report.arms.with.scenarioPassRate, 1);
	assert.ok(report.arms.without.scenarioPassRate < 0.5, "the without arm must lose on a deliberately bad mock");
	assert.equal(report.arms.with.noiseBand, 0, "deterministic mock trials must agree");
	assert.ok(report.ablation.wins > 0 && report.ablation.losses === 0);
	assert.equal(report.ablation.significance.test, "exact_sign_test");
	assert.ok(report.ablation.significance.decidedPairs >= 6);
	assert.ok(report.ablation.significance.pValue < 0.05);
	assert.equal(report.ablation.liftSignificant, true, "a win on most scenarios is significant");
	assert.equal(report.arms.with.interval.method, "scenario_clustered_normal");
	assert.equal(report.armOrder, "interleaved_alternating");
	assert.equal(report.health.healthy, true);
	assert.equal(report.score.aggregation, "majority_of_trials");
	assert.equal(report.score.byTrial.length, 2);
	assert.ok(report.arms.with.usage.calls > 0, "token usage must be summed");
	const firstTrials = Object.values(report.trajectories)[0];
	assert.equal(firstTrials.length, 2, "trajectories are reported for every trial");
	for (const trajectory of firstTrials) assert.deepEqual(trajectory.map((step) => step.type), ["load", "read"]);

	// The coin-flip case: one scenario differs (2/2 with, 0/2 without), every
	// other scenario ties. A noise band over all scenarios is near 0, so the old
	// check called this significant; one decided pair is not evidence.
	mockMode = "coinflip";
	const coinflip = await run(["scripts/evaluate-ai-change-harness.mjs", "--mode", "live", "--provider", "openai", "--model", "mock", "--arm", "both", "--trials", "2"]);
	assert.equal(coinflip.status, 0, coinflip.stderr || coinflip.stdout.slice(0, 500));
	const coinflipReport = JSON.parse(coinflip.stdout);
	assert.equal(coinflipReport.ablation.wins, 1);
	assert.equal(coinflipReport.ablation.losses, 0);
	assert.equal(coinflipReport.ablation.significance.decidedPairs, 1);
	assert.equal(coinflipReport.ablation.liftSignificant, false, "one decided pair must not be significant");

	// Every provider call failing must fail the run, even with --min-pass-rate 0,
	// and must not be scored as a skill failure.
	mockMode = "http500";
	const outage = await run(["scripts/evaluate-ai-change-harness.mjs", "--mode", "live", "--provider", "openai", "--model", "mock", "--arm", "both", "--trials", "1", "--min-pass-rate", "0"]);
	assert.equal(outage.status, 1, "a run where every provider call failed must exit non-zero");
	const outageReport = JSON.parse(outage.stdout);
	assert.equal(outageReport.status, "unhealthy");
	assert.deepEqual(outageReport.health.reasons, ["no_provider_call_completed", "adapter_error_share_exceeded"]);
	assert.equal(outageReport.arms.with.scoredScenarioRuns, 0, "provider errors are not scored as skill failures");
	assert.equal(outageReport.adapterErrors[0].httpStatus, 500);
	const skillOutage = await run(["scripts/skill-tests.mjs", "--mode", "live", "--provider", "openai", "--model", "mock", "--skill", "run-regression-gate", "--trials", "1", "--out", out]);
	assert.equal(skillOutage.status, 1, "skill tests must fail when every provider call failed");
	const skillOutageReport = JSON.parse(skillOutage.stdout);
	assert.equal(skillOutageReport.reports[0].health.healthy, false);
	mockMode = "deliberate";
	assert.ok(report.arms.without.usage.calls > 0);
	assert.equal(typeof report.ablation.tokenDelta, "number");

	// Bundle loading still works and keeps the legacy single-arm report shape.
	const bundle = await run(["scripts/evaluate-ai-change-harness.mjs", "--mode", "live", "--provider", "openai", "--model", "mock", "--loading", "bundle", "--arm", "without", "--min-pass-rate", "0"]);
	assert.equal(bundle.status, 0, bundle.stderr);
	assert.equal(JSON.parse(bundle.stdout).loading, "bundle");

	// Skill behavior tests for one skill, one trial.
	const skillRun = await run(["scripts/skill-tests.mjs", "--mode", "live", "--provider", "openai", "--model", "mock", "--skill", "run-regression-gate", "--trials", "1", "--out", out]);
	const skillReport = JSON.parse(skillRun.stdout);
	assert.equal(skillReport.executed, true);
	const gate = skillReport.reports[0];
	assert.equal(gate.skill, "run-regression-gate");
	assert.equal(gate.runFailures, 0);
	assert.equal(gate.health.healthy, true);
	assert.ok(gate.trajectory.variants.with.passRate > gate.trajectory.variants.without.passRate, "trajectory must favor the skill on the mock");
	if (process.env.EVALGATE_SDK_CLI) {
		assert.equal(skillRun.status, 0, skillRun.stderr);
		assert.equal(gate.sdk.cases, 13);
		assert.ok(gate.sdk.trigger.recall > 0.5, "the mock triggers on gate prompts");
		assert.ok(gate.sdk.task.difference > 0, "paired uplift must be positive on the mock");
	} else {
		assert.equal(skillRun.status, 0, skillRun.stderr);
		assert.equal(gate.sdk.skipped, true, "without EVALGATE_SDK_CLI the SDK is skipped, never fetched");
	}
} finally {
	server.close();
	rmSync(out, { recursive: true, force: true });
}
console.log(`PASS: live harness arms, trials, progressive loading and skill tests against a mock provider${process.env.EVALGATE_SDK_CLI ? " (scored by evalgate skill test)" : ""}`);
