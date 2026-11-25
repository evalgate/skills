// Exercises the live paths of both harnesses against a local mock of the
// OpenAI chat API, so CI covers ablation arms, trials, progressive loading
// and trajectory capture without credentials or network.
//
// When EVALGATE_SDK_CLI points at an installed @evalgate/sdk CLI, the skill
// tests are also scored by `skill test --observations` and the trigger and
// uplift numbers are asserted. Without it, only this repository's scoring runs.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fixtures = new Map(
	readFileSync(resolve(root, "evaluations/fixtures/passing-results.jsonl"), "utf8")
		.trim()
		.split(/\r?\n/u)
		.map((line) => JSON.parse(line))
		.map((row) => [row.scenarioId, row]),
);

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
		const body = JSON.parse(raw);
		const content = JSON.stringify(reply(body));
		response.setHeader("content-type", "application/json");
		response.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: Math.ceil(body.messages.map((m) => m.content).join("").length / 4), completion_tokens: 50 } }));
	});
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const env = { ...process.env, OPENAI_API_KEY: "mock-key", OPENAI_BASE_URL: `http://127.0.0.1:${server.address().port}` };

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
	assert.equal(report.ablation.liftExceedsNoise, true);
	assert.ok(report.arms.with.usage.calls > 0, "token usage must be summed");
	const firstTrajectory = Object.values(report.trajectories)[0];
	assert.deepEqual(firstTrajectory.map((step) => step.type), ["load", "read"]);
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
	assert.ok(gate.trajectory.variants.with.passRate > gate.trajectory.variants.without.passRate, "trajectory must favor the skill on the mock");
	if (process.env.EVALGATE_SDK_CLI) {
		assert.equal(skillRun.status, 0, skillRun.stderr);
		assert.equal(gate.sdk.cases, 13);
		assert.ok(gate.sdk.trigger.recall > 0.5, "the mock triggers on gate prompts");
		assert.ok(gate.sdk.task.difference > 0, "paired uplift must be positive on the mock");
	} else {
		assert.ok(gate.sdk, "an SDK report or SDK error is always attached");
	}
} finally {
	server.close();
	rmSync(out, { recursive: true, force: true });
}
console.log(`PASS: live harness arms, trials, progressive loading and skill tests against a mock provider${process.env.EVALGATE_SDK_CLI ? " (scored by evalgate skill test)" : ""}`);
