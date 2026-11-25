#!/usr/bin/env node
// Behavioral tests for every skill in the distribution.
//
//   fixture (default)  Validate every case file and self-test the trajectory
//                      scorer on synthesized answers. Executes no model and
//                      reports executed: false.
//   live               For each case, trial and variant (with / without the
//                      skill), run a real model with progressive skill loading,
//                      then score with EvalGate's own `skill test` (trigger F1
//                      and paired uplift with a 95% interval) and with this
//                      repository's trajectory scorer.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createChatProvider, discoverSkillDirectories, readFrontmatter } from "./lib/agent-loop.mjs";
import { actionVocabulary, runSkillCase } from "./lib/skill-case-runner.mjs";
import { PINNED_SDK } from "./lib/sdk-pin.mjs";
import { scoreObservation, scoreTrajectories, TRAJECTORY_FIELDS } from "./score-skill-trajectory.mjs";

const root = resolve(import.meta.dirname, "..");
const casesRoot = resolve(root, "evaluations/skills");
const SDK_CASE_FIELDS = ["id", "prompt", "expectTrigger", "task"];
const CASE_FIELDS = new Set([...SDK_CASE_FIELDS, "source", "trajectory"]);
const SOURCES = new Set(["authored", "real", "golden"]);
export const MINIMUM_CASES = 10;
export { PINNED_SDK };

/**
 * Environment for the SDK child process: the provider keys the agent loop
 * needs are removed, so the scorer never sees them.
 */
export function sdkEnvironment(env = process.env) {
	return Object.fromEntries(
		Object.entries(env).filter(([key]) => !/(^|_)(API_KEY|TOKEN|SECRET|PASSWORD)$|^(OPENAI|ANTHROPIC|OPENROUTER|GEMINI|GOOGLE|MISTRAL|GROQ|COHERE|AZURE_OPENAI)_/u.test(key)),
	);
}

export function skillDirectories() {
	return Object.fromEntries(
		discoverSkillDirectories(root).map((directory) => [
			readFrontmatter(resolve(directory, "SKILL.md")).name,
			directory,
		]),
	);
}

export function readCases(skillName) {
	const path = resolve(casesRoot, `${skillName}.cases.jsonl`);
	if (!existsSync(path)) return undefined;
	return readFileSync(path, "utf8")
		.split(/\r?\n/u)
		.filter((line) => line.trim())
		.map((line, index) => {
			try {
				return JSON.parse(line);
			} catch (error) {
				throw new Error(`${path}:${index + 1}: ${error.message}`);
			}
		});
}

/** Structural checks that keep case files compatible with `skill test` and honest. */
export function validateCases(skillName, cases, { skills, vocabulary }) {
	const failures = [];
	const vocab = new Set(vocabulary);
	const skillNames = new Set([...Object.keys(skills), "none"]);
	if (!cases) return [`${skillName}: missing evaluations/skills/${skillName}.cases.jsonl`];
	if (cases.length < MINIMUM_CASES) failures.push(`${skillName}: ${cases.length} cases; skill test needs at least ${MINIMUM_CASES}`);
	if (!cases.some((testCase) => testCase.expectTrigger === true)) failures.push(`${skillName}: no should-trigger case`);
	if (!cases.some((testCase) => testCase.expectTrigger === false)) failures.push(`${skillName}: no should-not-trigger case`);
	const withTask = cases.filter((testCase) => testCase.task).length;
	if (withTask < MINIMUM_CASES) failures.push(`${skillName}: ${withTask} cases with a task check; uplift needs at least ${MINIMUM_CASES}`);
	const ids = new Set();
	for (const testCase of cases) {
		const label = `${skillName}/${testCase.id}`;
		if (typeof testCase.id !== "string" || !testCase.id) failures.push(`${skillName}: case without id`);
		if (ids.has(testCase.id)) failures.push(`${label}: duplicate id`);
		ids.add(testCase.id);
		for (const key of Object.keys(testCase)) {
			if (!CASE_FIELDS.has(key)) failures.push(`${label}: unknown field ${key}`);
		}
		if (typeof testCase.prompt !== "string" || !testCase.prompt.trim()) failures.push(`${label}: empty prompt`);
		if (typeof testCase.expectTrigger !== "boolean") failures.push(`${label}: expectTrigger must be boolean`);
		if (!SOURCES.has(testCase.source)) failures.push(`${label}: source must be authored, real or golden`);
		if (testCase.task) {
			if (testCase.task.check !== "includes_all" || !Array.isArray(testCase.task.expected) || testCase.task.expected.length === 0) {
				failures.push(`${label}: task must be a non-empty includes_all check`);
			} else {
				for (const text of testCase.task.expected) {
					const route = text.match(/^"route":"([^"]+)"$/u);
					if (route && !skillNames.has(route[1])) failures.push(`${label}: task routes to unknown skill ${route[1]}`);
					const action = text.match(/^"([a-z_]+)"$/u);
					if (action && !vocab.has(action[1])) failures.push(`${label}: task action ${action[1]} is not in the vocabulary`);
				}
			}
		}
		for (const key of Object.keys(testCase.trajectory ?? {})) {
			if (!TRAJECTORY_FIELDS.includes(key) && key !== "allowActions") failures.push(`${label}: unknown trajectory field ${key}`);
		}
		for (const key of ["requiredActions", "forbiddenActions", "actionsInOrder", "allowActions"]) {
			for (const action of testCase.trajectory?.[key] ?? []) {
				if (!vocab.has(action)) failures.push(`${label}: trajectory action ${action} is not in the vocabulary`);
			}
		}
		for (const path of testCase.trajectory?.requiredReads ?? []) {
			if (!existsSync(resolve(skills[skillName] ?? "", path))) failures.push(`${label}: requiredReads names missing file ${path}`);
		}
	}
	return failures;
}

/** The answer a perfect agent would give; used only to self-test the scorer. */
function idealFinal(testCase) {
	const trajectory = testCase.trajectory ?? {};
	const actions = [...new Set([...(trajectory.actionsInOrder ?? []), ...(trajectory.requiredActions ?? [])])];
	const commands = [...(trajectory.commandsInOrder ?? [])];
	for (const text of testCase.task?.expected ?? []) {
		const action = text.match(/^"([a-z_]+)"$/u);
		if (action && !actions.includes(action[1])) actions.push(action[1]);
		else if (!text.startsWith('"') && !commands.some((command) => command.includes(text))) commands.push(text);
	}
	const route = (testCase.task?.expected ?? []).map((text) => text.match(/^"route":"([^"]+)"$/u)?.[1]).find(Boolean);
	return { route: route ?? "self", actions, commands, stop: null, reply: "Synthesized for scorer self-test." };
}

function selfTest(skillName, cases) {
	const failures = [];
	for (const testCase of cases) {
		const ideal = { variant: "with", exitCode: 0, output: JSON.stringify(idealFinal(testCase)), trajectory: (testCase.trajectory?.requiredReads ?? []).map((path) => ({ type: "read", target: `${skillName}/${path}`, ok: true })) };
		const idealFailures = scoreObservation(testCase, ideal, skillName);
		if (idealFailures.length) failures.push(`${skillName}/${testCase.id}: ideal answer fails trajectory: ${JSON.stringify(idealFailures)}`);
		const forbidden = testCase.trajectory?.forbiddenActions?.[0] ?? "retry_until_green";
		const bad = { ...ideal, output: JSON.stringify({ ...idealFinal(testCase), actions: [...idealFinal(testCase).actions, forbidden] }) };
		if (scoreObservation(testCase, bad, skillName).length === 0) failures.push(`${skillName}/${testCase.id}: forbidden action ${forbidden} was not caught`);
	}
	return failures;
}

function parseArgs(argv) {
	const args = { mode: "fixture", skill: "all", trials: 3, provider: undefined, model: undefined, temperature: undefined, out: resolve(root, ".evalgate/skill-tests"), minTriggerF1: undefined, minUplift: undefined, minTrajectoryPassRate: undefined, maxAdapterErrorShare: envShare("SKILL_EVAL_MAX_ADAPTER_ERROR_SHARE", 0.2), maxRunFailureShare: envShare("SKILL_EVAL_MAX_RUN_FAILURE_SHARE", 0.2), allowSkip: false };
	for (let index = 0; index < argv.length; index++) {
		const flag = argv[index];
		const value = argv[index + 1];
		const take = () => {
			if (value === undefined) throw new Error(`${flag} needs a value`);
			index++;
			return value;
		};
		if (flag === "--mode") args.mode = take();
		else if (flag === "--skill") args.skill = take();
		else if (flag === "--trials") args.trials = Number(take());
		else if (flag === "--provider") args.provider = take();
		else if (flag === "--model") args.model = take();
		else if (flag === "--temperature") args.temperature = Number(take());
		else if (flag === "--out") args.out = resolve(take());
		else if (flag === "--min-trigger-f1") args.minTriggerF1 = take();
		else if (flag === "--min-uplift") args.minUplift = take();
		else if (flag === "--min-trajectory-pass-rate") args.minTrajectoryPassRate = Number(take());
		else if (flag === "--max-adapter-error-share") args.maxAdapterErrorShare = Number(take());
		else if (flag === "--max-run-failure-share") args.maxRunFailureShare = Number(take());
		else if (flag === "--allow-skip") args.allowSkip = true;
		else if (flag === "--help" || flag === "-h") args.help = true;
		else throw new Error(`Unknown argument: ${flag}`);
	}
	if (!["fixture", "live"].includes(args.mode)) throw new Error("--mode must be fixture or live");
	if (!Number.isInteger(args.trials) || args.trials < 1 || args.trials > 20) throw new Error("--trials must be 1 to 20");
	for (const key of ["maxAdapterErrorShare", "maxRunFailureShare"]) {
		if (!(args[key] >= 0 && args[key] <= 1)) throw new Error(`${key} must be between 0 and 1`);
	}
	return args;
}

function envShare(name, fallback) {
	const value = process.env[name];
	if (value === undefined || value === "") return fallback;
	const parsed = Number(value);
	if (!(parsed >= 0 && parsed <= 1)) throw new Error(`${name} must be between 0 and 1`);
	return parsed;
}

const HELP = `EvalGate skill behavior tests

Usage:
  node scripts/skill-tests.mjs [--mode fixture]
  node scripts/skill-tests.mjs --mode live --provider openai|anthropic --model <id>
      [--skill <name>|all] [--trials 3] [--temperature <t>] [--out <dir>]
      [--min-trigger-f1 <0..1>] [--min-uplift <-1..1>] [--min-trajectory-pass-rate <0..1>]
      [--max-adapter-error-share <0..1>] [--max-run-failure-share <0..1>]

Live mode runs each case with and without the skill, with progressive loading,
then scores trigger F1 and paired uplift with \`npx @evalgate/sdk skill test
--observations\` and the command/action/read trajectory with this repository's
scorer. Observations are written to --out so a run can be rescored. With no
thresholds the run still fails when it measured nothing: no completed
provider call, more provider errors (HTTP, network, timeout) than
--max-adapter-error-share (default 0.2), or more failed agent runs than
--max-run-failure-share (default 0.2). Provider errors are reported apart and
left out of trajectory scoring. With and without run in alternating order.

Scoring uses ${PINNED_SDK} (override with EVALGATE_SDK or a local
EVALGATE_SDK_CLI), started without provider keys in its environment.
EVALGATE_SDK_DISABLE=1 skips SDK scoring and says so in the report.`;

function runSdkSkillTest({ directory, casesPath, observationsPath, trials, minTriggerF1, minUplift }) {
	if (process.env.EVALGATE_SDK_DISABLE === "1") {
		return { skipped: true, reason: "SDK scoring disabled (EVALGATE_SDK_DISABLE=1); set EVALGATE_SDK_CLI to a local @evalgate/sdk CLI to score trigger F1 and uplift." };
	}
	const sdk = process.env.EVALGATE_SDK ?? PINNED_SDK;
	const args = ["skill", "test", "--skill", directory, "--cases", casesPath, "--observations", observationsPath, "--trials", String(trials), "--format", "json"];
	if (minTriggerF1 !== undefined) args.push("--min-trigger-f1", String(minTriggerF1));
	if (minUplift !== undefined) args.push("--min-uplift", String(minUplift));
	const command = process.env.EVALGATE_SDK_CLI
		? [process.execPath, [resolve(process.env.EVALGATE_SDK_CLI), ...args]]
		: [process.platform === "win32" ? "npx.cmd" : "npx", ["--yes", sdk, ...args]];
	const result = spawnSync(command[0], command[1], { encoding: "utf8", timeout: 300_000, shell: process.platform === "win32", env: sdkEnvironment() });
	const line = (result.stdout ?? "").trim().split(/\r?\n/u).pop() ?? "";
	try {
		return JSON.parse(line);
	} catch {
		return { error: { code: "SDK_UNAVAILABLE", message: (result.stderr ?? "").slice(0, 500) || "skill test produced no JSON" }, exitCode: result.status ?? 2 };
	}
}

async function live(args, skills) {
	const { metadata, chat } = createChatProvider({ provider: args.provider, model: args.model, temperature: args.temperature });
	if (!chat) {
		console.log(JSON.stringify({ schemaVersion: 1, mode: "skill_behavior_live", executed: false, status: "skipped", reason: `Missing credentials for ${metadata.provider}`, metadata }));
		return args.allowSkip ? 0 : 2;
	}
	const names = args.skill === "all" ? Object.keys(skills).sort() : [args.skill];
	mkdirSync(args.out, { recursive: true });
	const reports = [];
	let failed = false;
	for (const name of names) {
		if (!skills[name]) throw new Error(`Unknown skill ${name}`);
		const cases = readCases(name);
		const observations = [];
		for (const [caseIndex, testCase] of cases.entries()) {
			for (let trial = 1; trial <= args.trials; trial++) {
				// Alternate which variant runs first, so drift and rate limits hit both.
				const order = (caseIndex + trial) % 2 === 0 ? ["with", "without"] : ["without", "with"];
				for (const variant of order) {
					const observation = await runSkillCase({ chat, targetSkill: name, variant, prompt: testCase.prompt });
					observations.push({ caseId: testCase.id, trial, ...observation });
				}
			}
		}
		const casesPath = resolve(args.out, `${name}.sdk-cases.jsonl`);
		const observationsPath = resolve(args.out, `${name}.sdk-observations.jsonl`);
		const fullPath = resolve(args.out, `${name}.observations.jsonl`);
		writeFileSync(casesPath, cases.map((testCase) => JSON.stringify(Object.fromEntries(SDK_CASE_FIELDS.filter((key) => key in testCase).map((key) => [key, testCase[key]])))).join("\n") + "\n");
		writeFileSync(observationsPath, observations.map(({ caseId, trial, variant, invokedSkills, output, exitCode }) => JSON.stringify({ caseId, trial, variant, invokedSkills, output, exitCode })).join("\n") + "\n");
		writeFileSync(fullPath, observations.map((observation) => JSON.stringify(observation)).join("\n") + "\n");
		const sdkReport = runSdkSkillTest({ directory: skills[name], casesPath, observationsPath, trials: args.trials, minTriggerF1: args.minTriggerF1, minUplift: args.minUplift });
		const adapterErrors = observations.filter((o) => o.adapterError).length;
		// Provider failures say nothing about the skill: leave them out of the trajectory score.
		const trajectory = scoreTrajectories(cases, observations.filter((o) => !o.adapterError), name);
		const usage = (variant) => observations.filter((o) => o.variant === variant).reduce((sum, o) => sum + o.usage.inputTokens + o.usage.outputTokens, 0);
		const perVariant = (variant) => observations.filter((o) => o.variant === variant).length;
		const tokens = { with: Math.round(usage("with") / Math.max(1, perVariant("with"))), without: Math.round(usage("without") / Math.max(1, perVariant("without"))) };
		const runFailures = observations.filter((o) => o.exitCode !== 0 && !o.adapterError).length;
		const calls = observations.reduce((sum, o) => sum + (o.usage?.calls ?? 0), 0);
		const share = (count) => (observations.length === 0 ? null : Number((count / observations.length).toFixed(4)));
		const health = { observations: observations.length, calls, adapterErrors, adapterErrorShare: share(adapterErrors), maxAdapterErrorShare: args.maxAdapterErrorShare, runFailures, runFailureShare: share(runFailures), maxRunFailureShare: args.maxRunFailureShare, reasons: [] };
		if (calls === 0) health.reasons.push("no_provider_call_completed");
		if (health.adapterErrorShare !== null && health.adapterErrorShare > args.maxAdapterErrorShare) health.reasons.push("adapter_error_share_exceeded");
		if (health.runFailureShare !== null && health.runFailureShare > args.maxRunFailureShare) health.reasons.push("run_failure_share_exceeded");
		health.healthy = health.reasons.length === 0;
		const sdkFailed = typeof sdkReport.exitCode === "number" && sdkReport.exitCode !== 0 && (args.minTriggerF1 !== undefined || args.minUplift !== undefined);
		const trajectoryFailed = args.minTrajectoryPassRate !== undefined && (trajectory.variants.with?.passRate ?? 0) < args.minTrajectoryPassRate;
		if (sdkFailed || trajectoryFailed || sdkReport.error || !health.healthy) failed = true;
		reports.push({ skill: name, cases: cases.length, sources: countSources(cases), health, runFailures, adapterErrors, sdk: sdkReport, trajectory: { variants: trajectory.variants, provenance: trajectory.provenance, failures: trajectory.failures.slice(0, 50) }, meanTokensPerCase: tokens, observationsPath: fullPath });
	}
	console.log(JSON.stringify({ schemaVersion: 1, mode: "skill_behavior_live", executed: true, metadata, trials: args.trials, reports }));
	return failed ? 1 : 0;
}

function countSources(cases) {
	const counts = { authored: 0, real: 0, golden: 0 };
	for (const testCase of cases) counts[testCase.source] = (counts[testCase.source] ?? 0) + 1;
	return counts;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(HELP);
		return 0;
	}
	const skills = skillDirectories();
	const vocabulary = actionVocabulary();
	const failures = [];
	const summary = [];
	for (const name of Object.keys(skills).sort()) {
		const cases = readCases(name);
		failures.push(...validateCases(name, cases, { skills, vocabulary }));
		if (cases) {
			failures.push(...selfTest(name, cases));
			summary.push({ skill: name, cases: cases.length, shouldTrigger: cases.filter((c) => c.expectTrigger).length, sources: countSources(cases) });
		}
	}
	for (const file of readdirSync(casesRoot).filter((file) => file.endsWith(".cases.jsonl"))) {
		if (!skills[file.replace(".cases.jsonl", "")]) failures.push(`${file}: no installed skill with that name`);
	}
	if (failures.length) {
		for (const failure of failures) console.error(`FAIL: ${failure}`);
		return 1;
	}
	if (args.mode === "live") return live(args, skills);
	console.log(JSON.stringify({ schemaVersion: 1, mode: "skill_behavior_fixture", executed: false, evidenceSource: "case_validation_and_scorer_self_test", skills: summary }));
	return 0;
}

try {
	process.exitCode = await main();
} catch (error) {
	console.error(JSON.stringify({ schemaVersion: 1, mode: "skill_behavior", executed: false, status: "error", reason: error instanceof Error ? error.message : String(error) }));
	process.exitCode = 2;
}
