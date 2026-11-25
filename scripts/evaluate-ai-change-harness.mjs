#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	validateDecisionContract,
	evidenceDimensions,
} from "./evaluate-ai-change-contract.mjs";
import { scoreSkillEvaluation } from "./score-skill-evaluation.mjs";
import {
	buildCatalog,
	bundleSystemPrompt,
	createChatProvider,
	DEFAULT_ALPHA,
	DEFAULT_MIN_DECIDED_PAIRS,
	discoverSkillDirectories,
	isAdapterError,
	noiseBand,
	pairedSignTest,
	progressiveSystemPrompt,
	runAgentTask,
	scenarioClusteredInterval,
	wilsonInterval,
} from "./lib/agent-loop.mjs";

const root = resolve(import.meta.dirname, "..");
const scenarioPath = resolve(
	root,
	"evaluations/evaluate-ai-change.scenarios.jsonl",
);
const defaultFixturePath = resolve(
	root,
	"evaluations/fixtures/passing-results.jsonl",
);
const distributionVersion = JSON.parse(
	readFileSync(resolve(root, "package.json"), "utf8"),
).version;
const skillPath = resolve(root, "skills/evaluate-ai-change/SKILL.md");
const decisionSchema = JSON.parse(
	readFileSync(
		resolve(root, "skills/evaluate-ai-change/assets/decision-contract.schema.json"),
		"utf8",
	),
);

function hash(value) {
	return createHash("sha256").update(value).digest("hex");
}

function skillCommit() {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: root,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return process.env.SKILL_COMMIT ?? "unknown";
	}
}

const routedSkillFiles = [
	"setup-evalgate-project/SKILL.md",
	"run-regression-gate/SKILL.md",
	"collect-agent-traces/SKILL.md",
	"ask-repository-question/SKILL.md",
	"use-evalgate-mcp/SKILL.md",
];

/**
 * The bundle for one arm. "with" carries the evaluated skill, its references
 * and the sibling skills it routes to; "without" carries the same sibling
 * skills and output contract, and only the evaluated skill removed. Progressive
 * loading removes the same single skill from the catalog, so the without arm
 * means the same thing in both loading modes.
 */
function assembleSkillBundle(arm = "with") {
	if (arm === "without") {
		return [
			...routedSkillFiles.map((file) =>
				`Routed Skill: ${file}\n${readFileSync(resolve(root, "skills", file), "utf8")}`,
			),
			outputContract(),
		].join("\n\n");
	}
	const primary = readFileSync(skillPath, "utf8");
	const referenceFiles = readdirSync(
		resolve(root, "skills/evaluate-ai-change/references"),
	)
		.filter((file) => file.endsWith(".md"))
		.sort();
	return [
		...skillSections(primary, routedSkillFiles, referenceFiles),
		outputContract(),
	].join("\n\n");
}

function outputContract() {
	return [
		"Output schema: " + JSON.stringify(decisionSchema),
		"Required output: return one strict JSON decision object; do not add prose or unknown fields.",
		`Evidence dimensions: ${evidenceDimensions.join(", ")}`,
	].join("\n\n");
}

function skillSections(primary, routedFiles, referenceFiles) {
	return [
		`Primary Skill: ${skillPath}\n${primary}`,
		...routedFiles.map((file) =>
			`Routed Skill: ${file}\n${readFileSync(resolve(root, "skills", file), "utf8")}`,
		),
		...referenceFiles.map((file) =>
			`Reference: ${file}\n${readFileSync(resolve(root, "skills/evaluate-ai-change/references", file), "utf8")}`,
		),
	];
}

function readJsonLines(filePath) {
	return readFileSync(filePath, "utf8")
		.split(/\r?\n/u)
		.filter((line) => line.trim().length > 0)
		.map((line, index) => {
			try {
				return JSON.parse(line);
			} catch (error) {
				throw new Error(`${filePath}:${index + 1}: ${error.message}`);
			}
		});
}


function envShare(name, fallback) {
	const value = process.env[name];
	if (value === undefined || value === "") return fallback;
	const parsed = Number(value);
	if (!(parsed >= 0 && parsed <= 1)) throw new Error(`${name} must be between 0 and 1`);
	return parsed;
}

function parseArgs(argv) {
	const args = {
		mode: "fixture",
		fixturePath: defaultFixturePath,
		adapterPath: undefined,
		comparePaths: undefined,
		compareProviders: undefined,
		provider: undefined,
		model: undefined,
		allowSkip: false,
		arm: "with",
		trials: 1,
		loading: "progressive",
		temperature: undefined,
		minPassRate: 1,
		maxAdapterErrorShare: envShare("SKILL_EVAL_MAX_ADAPTER_ERROR_SHARE", 0.2),
		minDecidedPairs: DEFAULT_MIN_DECIDED_PAIRS,
		alpha: DEFAULT_ALPHA,
	};
	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === "--mode" && argv[index + 1]) {
			args.mode = argv[++index];
		} else if (argument === "--fixture" && argv[index + 1]) {
			args.fixturePath = resolve(argv[++index]);
		} else if (argument === "--adapter" && argv[index + 1]) {
			args.adapterPath = resolve(argv[++index]);
		} else if (argument === "--compare" && argv[index + 1]) {
			const paths = argv[++index]
				.split(",")
				.map((path) => path.trim())
				.filter(Boolean);
			if (paths.length !== 2) {
				throw new Error("--compare requires two comma-separated adapter paths");
			}
			args.mode = "compare";
			args.comparePaths = paths.map((path) => resolve(path));
		} else if (argument === "--compare-providers" && argv[index + 1]) {
			const specs = argv[++index]
				.split(",")
				.map((spec) => spec.trim())
				.filter(Boolean);
			if (specs.length !== 2 || specs.some((spec) => !spec.includes(":"))) {
				throw new Error(
					"--compare-providers requires two provider:model specifications",
				);
			}
			args.mode = "compare";
			args.compareProviders = specs.map((spec) => {
				const separator = spec.indexOf(":");
				return {
					provider: spec.slice(0, separator),
					model: spec.slice(separator + 1),
				};
			});
		} else if (argument === "--provider" && argv[index + 1]) {
			args.provider = argv[++index];
		} else if (argument === "--model" && argv[index + 1]) {
			args.model = argv[++index];
		} else if (argument === "--arm" && argv[index + 1]) {
			args.arm = argv[++index];
		} else if (argument === "--trials" && argv[index + 1]) {
			args.trials = Number(argv[++index]);
		} else if (argument === "--loading" && argv[index + 1]) {
			args.loading = argv[++index];
		} else if (argument === "--temperature" && argv[index + 1]) {
			args.temperature = Number(argv[++index]);
		} else if (argument === "--min-pass-rate" && argv[index + 1]) {
			args.minPassRate = Number(argv[++index]);
		} else if (argument === "--max-adapter-error-share" && argv[index + 1]) {
			args.maxAdapterErrorShare = Number(argv[++index]);
		} else if (argument === "--min-decided-pairs" && argv[index + 1]) {
			args.minDecidedPairs = Number(argv[++index]);
		} else if (argument === "--alpha" && argv[index + 1]) {
			args.alpha = Number(argv[++index]);
		} else if (argument === "--allow-skip") {
			args.allowSkip = true;
		} else if (argument === "--help" || argument === "-h") {
			args.help = true;
		} else {
			throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (!["fixture", "live", "compare"].includes(args.mode)) {
		throw new Error(`--mode must be fixture, live, or compare, got ${args.mode}`);
	}
	if (!["with", "without", "both"].includes(args.arm)) {
		throw new Error(`--arm must be with, without, or both, got ${args.arm}`);
	}
	if (!["progressive", "bundle"].includes(args.loading)) {
		throw new Error(`--loading must be progressive or bundle, got ${args.loading}`);
	}
	if (!Number.isInteger(args.trials) || args.trials < 1 || args.trials > 20) {
		throw new Error("--trials must be an integer from 1 to 20");
	}
	if (!(args.minPassRate >= 0 && args.minPassRate <= 1)) {
		throw new Error("--min-pass-rate must be between 0 and 1");
	}
	if (!(args.maxAdapterErrorShare >= 0 && args.maxAdapterErrorShare <= 1)) {
		throw new Error("--max-adapter-error-share must be between 0 and 1");
	}
	if (!Number.isInteger(args.minDecidedPairs) || args.minDecidedPairs < 1) {
		throw new Error("--min-decided-pairs must be a positive integer");
	}
	if (!(args.alpha > 0 && args.alpha < 1)) {
		throw new Error("--alpha must be between 0 and 1");
	}
	if (args.temperature !== undefined && !(args.temperature >= 0 && args.temperature <= 2)) {
		throw new Error("--temperature must be between 0 and 2");
	}
	return args;
}

function printHelp() {
	console.log(`EvalGate evaluate-ai-change behavioral harness

Usage:
  node scripts/evaluate-ai-change-harness.mjs [options]

Options:
  --mode fixture          Score committed provider-neutral contract fixtures (default)
  --fixture <path>        JSONL result fixture to score
  --mode live             Run an explicitly supplied provider-neutral adapter
  --adapter <path>        ESM adapter exporting evaluateScenario({ scenario })
  --provider <name>       Built-in provider adapter: openai or anthropic
  --model <id>            Model identifier for a built-in provider adapter
  --arm with|without|both Run with the skill, without it, or both (ablation)
  --trials <n>            Repeat each arm n times (1-20); n > 1 reports a noise band
  --loading progressive   Built-in adapter sees skill names and descriptions and loads
                          SKILL.md and references on demand, like a real client (default)
  --loading bundle        Concatenate every skill and reference into one prompt (ceiling)
  --temperature <t>       Sampling temperature for built-in adapters (provider default if unset)
  --min-pass-rate <r>     Fraction of with-skill trials that must pass the contract (default 1)
  --max-adapter-error-share <r>
                          Fail the run when more than this share of scenario runs
                          ended in a provider error (HTTP, network, timeout), or no
                          provider call succeeded (default 0.2; env
                          SKILL_EVAL_MAX_ADAPTER_ERROR_SHARE)
  --min-decided-pairs <n> Scenarios with a with/without difference needed before
                          lift can be significant (default ${DEFAULT_MIN_DECIDED_PAIRS})
  --alpha <a>             Significance level of the paired sign test (default ${DEFAULT_ALPHA})
  --allow-skip             Allow requested live/compare runs with no execution to exit 0
  --compare <a>,<b>       Compare two explicit adapters (optional model/provider comparison)
  --compare-providers <a:m1>,<b:m2>
                         Compare two built-in provider/model pairs (opt-in)
  --help                  Show this help

Fixture mode is deterministic contract evidence. It does not execute an agent,
call a provider, or prove runtime behavior. Live and compare modes are optional
and require caller-supplied, credential-safe adapters or the explicit built-in
OpenAI/Anthropic provider adapter (OPENAI_API_KEY or ANTHROPIC_API_KEY).
Reports include parse status, provider/model,
Skill revision, hashes, latency, token usage, loading trajectory and contract
score without raw prompts or secrets. The without arm keeps the output schema
and the sibling skills and removes only the evaluated skill, in both loading
modes, so a difference is attributable to it. Arms run interleaved per
scenario in alternating order, so provider drift and rate limits hit both.
Lift is decided by an exact two-sided sign test over scenarios (each scenario
is one pair; ties are dropped), not by the noise band, which is descriptive.
Pass-rate intervals are clustered by scenario. Provider failures are reported
as adapter errors and excluded from skill pass/fail.
Requested live/compare execution with no adapter run exits 2 unless
--allow-skip is explicit.`);
}

async function loadAdapter(adapterPath) {
	const imported = await import(pathToFileURL(adapterPath).href);
	const adapter = imported.evaluateScenario ?? imported.default;
	if (typeof adapter !== "function") {
		throw new Error(
			`Adapter ${adapterPath} must export evaluateScenario({ scenario }) or a default function`,
		);
	}
	return { evaluateScenario: adapter, metadata: imported.metadata ?? {} };
}

function createBuiltinAdapter(provider, model, { loading = "progressive", temperature } = {}) {
	const { metadata, chat } = createChatProvider({ provider, model, temperature });
	metadata.loading = loading;
	if (temperature !== undefined) metadata.temperature = temperature;
	if (!chat) return { evaluateScenario: undefined, metadata };
	return {
		metadata,
		evaluateScenario: async ({ scenario, arm = "with" }) => {
			const userContent = `${scenario.userRequest ?? scenario.prompt}\n\nReturn only one JSON object matching the supplied canonical decision schema. Include scenarioId exactly as ${scenario.scenarioId}.`;
			const progressive = loading === "progressive";
			const contract = outputContract();
			const catalog = progressive
				? buildCatalog(discoverSkillDirectories(root), {
						exclude: arm === "without" ? ["evaluate-ai-change"] : [],
					})
				: [];
			const system = progressive
				? progressiveSystemPrompt(
						catalog,
						`${contract}\n\nWhen you answer, reply {"final": <decision object>}.`,
					)
				: bundleSystemPrompt([assembleSkillBundle(arm)], "");
			const run = await runAgentTask({ chat, system, userContent, catalog, progressive });
			if (run.error) {
				const error = new Error(`Agent run for ${scenario.scenarioId} ended with ${run.error}${run.detail ? `: ${run.detail}` : ""}`);
				error.agentRun = run;
				if (run.adapterError) {
					error.adapterError = true;
					error.status = run.httpStatus;
				}
				throw error;
			}
			const failures = validateDecisionContract(run.final, { requireScenarioId: true });
			if (failures.length > 0) {
				const error = new Error(
					`Provider decision failed the canonical contract for ${scenario.scenarioId}: ${failures.join("; ")}`,
				);
				error.agentRun = run;
				throw error;
			}
			return { __agentRun: true, decision: run.final, ...run };
		},
	};
}

function emptyUsage() {
	return { inputTokens: 0, outputTokens: 0, calls: 0 };
}

function emptyRun() {
	return {
		results: [],
		parseFailures: [],
		adapterErrors: [],
		promptHashes: {},
		outputHashes: {},
		latencyMsByScenario: {},
		trajectories: {},
		invokedSkills: {},
		usage: emptyUsage(),
	};
}

function addRunUsage(usage, partial) {
	for (const key of Object.keys(usage)) usage[key] += partial?.[key] ?? 0;
}

/** Run one scenario for one arm and record it into `run`. */
async function runScenario(adapter, scenario, armBundle, arm, run) {
	const startedAt = Date.now();
	let result;
	try {
		result = await adapter.evaluateScenario({
			system: armBundle,
			instructions: armBundle,
			skill: armBundle,
			arm,
			scenario,
			repositoryContext: scenario.repositoryContext ?? {},
			availableEvidence: scenario.availableEvidence ?? {},
			outputSchema: decisionSchema,
		});
	} catch (error) {
		// One bad turn must not abort the remaining scenarios. A provider failure
		// is reported apart and excluded from skill pass/fail; anything else (bad
		// JSON, a broken contract, the loading turn limit) is a skill failure.
		run.latencyMsByScenario[scenario.scenarioId] = Date.now() - startedAt;
		const agentRun = error?.agentRun;
		if (agentRun) {
			run.trajectories[scenario.scenarioId] = agentRun.trajectory;
			run.invokedSkills[scenario.scenarioId] = agentRun.invokedSkills;
			addRunUsage(run.usage, agentRun.usage);
		}
		const detail = error instanceof Error ? error.message : String(error);
		if (isAdapterError(error)) {
			run.adapterErrors.push({
				scenarioId: scenario.scenarioId,
				reason: "adapter_error",
				httpStatus: typeof error?.status === "number" ? error.status : undefined,
				detail,
			});
		} else {
			run.parseFailures.push({ scenarioId: scenario.scenarioId, reason: "agent_failure", detail });
		}
		return;
	}
	run.latencyMsByScenario[scenario.scenarioId] = Date.now() - startedAt;
	if (result?.__agentRun) {
		run.trajectories[scenario.scenarioId] = result.trajectory;
		run.invokedSkills[scenario.scenarioId] = result.invokedSkills;
		addRunUsage(run.usage, result.usage);
		result = result.decision;
	}
	run.promptHashes[scenario.scenarioId] = hash(`${armBundle}\n${JSON.stringify(scenario)}`);
	run.outputHashes[scenario.scenarioId] = hash(JSON.stringify(result ?? null));
	if (!result || typeof result !== "object" || Array.isArray(result)) {
		run.parseFailures.push({ scenarioId: scenario.scenarioId, reason: "non_object_result" });
		return;
	}
	const contractFailures = validateDecisionContract(result, { requireScenarioId: true });
	if (contractFailures.length > 0) {
		run.parseFailures.push({
			scenarioId: scenario.scenarioId,
			reason: "invalid_decision_contract",
			detail: contractFailures,
		});
	}
	run.results.push(result);
}

/** Run every scenario once for one arm (compare mode and single-arm use). */
async function runAdapter(adapter, scenarios, arm = "with") {
	const run = emptyRun();
	const armBundle = assembleSkillBundle(arm);
	for (const scenario of scenarios) await runScenario(adapter, scenario, armBundle, arm, run);
	return run;
}

/**
 * Run every arm and trial with the arms interleaved per scenario. The order
 * alternates by trial and scenario, so neither arm always goes first and
 * provider drift or rate limiting lands on both arms alike.
 */
async function runInterleaved(adapter, scenarios, armNames, trials) {
	const bundles = Object.fromEntries(armNames.map((arm) => [arm, assembleSkillBundle(arm)]));
	const runs = Object.fromEntries(armNames.map((arm) => [arm, Array.from({ length: trials }, emptyRun)]));
	const latency = Object.fromEntries(armNames.map((arm) => [arm, Array.from({ length: trials }, () => 0)]));
	for (let trial = 0; trial < trials; trial++) {
		for (let index = 0; index < scenarios.length; index++) {
			const order = (trial + index) % 2 === 0 ? armNames : [...armNames].reverse();
			for (const arm of order) {
				const startedAt = Date.now();
				await runScenario(adapter, scenarios[index], bundles[arm], arm, runs[arm][trial]);
				latency[arm][trial] += Date.now() - startedAt;
			}
		}
	}
	return Object.fromEntries(
		armNames.map((arm) => [
			arm,
			runs[arm].map((run, index) => ({
				trial: index + 1,
				run,
				score: scoreSkillEvaluation(scenarios, run.results),
				latencyMs: latency[arm][index],
			})),
		]),
	);
}

/**
 * Per-scenario outcome for one trial: true (passed), false (failed the skill
 * contract) or null (a provider failure, excluded from skill pass/fail).
 */
function trialOutcomes(scenarios, trial) {
	const failed = new Set(
		[...trial.score.decisionFailures, ...trial.score.reportingFailures].map((failure) => failure.scenarioId),
	);
	for (const failure of trial.run.parseFailures) failed.add(failure.scenarioId);
	const adapterErrored = new Set(trial.run.adapterErrors.map((failure) => failure.scenarioId));
	return new Map(
		scenarios.map((scenario) => [
			scenario.scenarioId,
			adapterErrored.has(scenario.scenarioId) ? null : !failed.has(scenario.scenarioId),
		]),
	);
}

function scenarioRate(outcomes) {
	const counted = outcomes.filter((outcome) => outcome !== null);
	return counted.length === 0 ? null : counted.filter(Boolean).length / counted.length;
}

function summarizeArm(scenarios, trialRuns) {
	const outcomesByCase = new Map(scenarios.map((scenario) => [scenario.scenarioId, []]));
	const usage = emptyUsage();
	let latencyMs = 0;
	let adapterErrors = 0;
	let trialsPassed = 0;
	for (const trial of trialRuns) {
		const outcomes = trialOutcomes(scenarios, trial);
		// A trial passes when every scenario it scored passed; provider failures
		// are neither passes nor failures of the skill.
		if ([...outcomes.values()].every((outcome) => outcome !== false)) trialsPassed++;
		for (const scenario of scenarios) {
			outcomesByCase.get(scenario.scenarioId).push(outcomes.get(scenario.scenarioId));
		}
		addRunUsage(usage, trial.run.usage);
		latencyMs += trial.latencyMs;
		adapterErrors += trial.run.adapterErrors.length;
	}
	const counted = [...outcomesByCase.values()].flat().filter((outcome) => outcome !== null);
	const passes = counted.filter(Boolean).length;
	const attempts = scenarios.length * trialRuns.length;
	return {
		trials: trialRuns.length,
		trialsPassed,
		scenarioRuns: attempts,
		scoredScenarioRuns: counted.length,
		adapterErrors,
		scenarioPassRate: counted.length === 0 ? null : Number((passes / counted.length).toFixed(4)),
		// Trials of one scenario are not independent: the interval is clustered by scenario.
		interval: scenarioClusteredInterval(
			scenarios.map((scenario) => scenarioRate(outcomesByCase.get(scenario.scenarioId))),
		),
		noiseBand: noiseBand(outcomesByCase),
		usage,
		meanTokensPerScenario:
			attempts === 0 ? null : Math.round((usage.inputTokens + usage.outputTokens) / attempts),
		latencyMs,
		outcomesByCase,
	};
}

function pairedComparison(scenarios, withArm, withoutArm, { alpha, minDecidedPairs }) {
	let wins = 0;
	let losses = 0;
	let ties = 0;
	let unscored = 0;
	const byScenario = {};
	for (const scenario of scenarios) {
		const withRate = scenarioRate(withArm.outcomesByCase.get(scenario.scenarioId));
		const withoutRate = scenarioRate(withoutArm.outcomesByCase.get(scenario.scenarioId));
		let outcome;
		if (withRate === null || withoutRate === null) {
			outcome = "unscored";
			unscored++;
		} else if (withRate > withoutRate) {
			outcome = "win";
			wins++;
		} else if (withRate < withoutRate) {
			outcome = "loss";
			losses++;
		} else {
			outcome = "tie";
			ties++;
		}
		byScenario[scenario.scenarioId] = { withRate, withoutRate, outcome };
	}
	const difference =
		withArm.scenarioPassRate === null || withoutArm.scenarioPassRate === null
			? null
			: Number((withArm.scenarioPassRate - withoutArm.scenarioPassRate).toFixed(4));
	const significance = pairedSignTest(wins, losses, { alpha, minDecidedPairs });
	const decided = wins + losses;
	return {
		difference,
		wins,
		losses,
		ties,
		unscored,
		winShare: decided === 0 ? null : Number((wins / decided).toFixed(4)),
		winShareInterval: wilsonInterval(wins, decided),
		significance,
		liftSignificant: significance.significant && significance.direction === "with_better",
		// Descriptive only: how often repeated trials of one arm disagreed.
		noiseBand:
			withArm.noiseBand === null && withoutArm.noiseBand === null
				? null
				: Math.max(withArm.noiseBand ?? 0, withoutArm.noiseBand ?? 0),
		tokenDelta:
			withArm.meanTokensPerScenario === null || withoutArm.meanTokensPerScenario === null
				? null
				: withArm.meanTokensPerScenario - withoutArm.meanTokensPerScenario,
		byScenario,
	};
}

/**
 * Whether the run measured anything. With a built-in provider, a run with no
 * completed call, or with more provider errors than allowed, is not evidence
 * about the skill and must not pass.
 */
function runHealth(arms, { builtin, maxAdapterErrorShare }) {
	const values = Object.values(arms);
	const attempts = values.reduce((sum, arm) => sum + arm.scenarioRuns, 0);
	const adapterErrors = values.reduce((sum, arm) => sum + arm.adapterErrors, 0);
	const calls = values.reduce((sum, arm) => sum + arm.usage.calls, 0);
	const adapterErrorShare = attempts === 0 ? null : Number((adapterErrors / attempts).toFixed(4));
	const reasons = [];
	if (builtin && calls === 0) reasons.push("no_provider_call_completed");
	if (adapterErrorShare !== null && adapterErrorShare > maxAdapterErrorShare) reasons.push("adapter_error_share_exceeded");
	return { attempts, adapterErrors, adapterErrorShare, maxAdapterErrorShare, calls, healthy: reasons.length === 0, reasons };
}

/** Top-level result over every trial of one arm, not the first trial only. */
function overallResult(scenarios, trialRuns, arm) {
	const trials = trialRuns.length;
	const majority = (predicate) => trialRuns.filter(predicate).length * 2 > trials;
	const trajectories = {};
	const invokedSkills = {};
	for (const scenario of scenarios) {
		trajectories[scenario.scenarioId] = trialRuns.map((trial) => trial.run.trajectories[scenario.scenarioId] ?? null);
		invokedSkills[scenario.scenarioId] = trialRuns.map((trial) => trial.run.invokedSkills[scenario.scenarioId] ?? null);
	}
	const mean = (select) => Number((trialRuns.reduce((sum, trial) => sum + (select(trial) ? 1 : 0), 0) / trials).toFixed(4));
	return {
		parsePassed: trialRuns.every((trial) => trial.run.parseFailures.length === 0),
		parseFailures: trialRuns.flatMap((trial) => trial.run.parseFailures.map((failure) => ({ trial: trial.trial, ...failure }))),
		adapterErrors: trialRuns.flatMap((trial) => trial.run.adapterErrors.map((failure) => ({ trial: trial.trial, ...failure }))),
		trajectories,
		invokedSkills,
		score: {
			arm,
			aggregation: "majority_of_trials",
			trials,
			passed: majority((trial) => trial.score.passed),
			decisionPassed: majority((trial) => trial.score.decisionPassed),
			reportingPassed: majority((trial) => trial.score.reportingPassed),
			passRate: mean((trial) => trial.score.passed),
			decisionPassRate: mean((trial) => trial.score.decisionPassed),
			reportingPassRate: mean((trial) => trial.score.reportingPassed),
			byTrial: trialRuns.map((trial) => ({
				trial: trial.trial,
				passed: trial.score.passed,
				decisionPassed: trial.score.decisionPassed,
				reportingPassed: trial.score.reportingPassed,
				decisionFailures: trial.score.decisionFailures,
				reportingFailures: trial.score.reportingFailures,
			})),
		},
	};
}

function publicArm(arm) {
	const { outcomesByCase, ...rest } = arm;
	return rest;
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return 0;
	}
	const scenarios = readJsonLines(scenarioPath);

	if (args.mode === "fixture") {
		const results = readJsonLines(args.fixturePath);
		const score = scoreSkillEvaluation(scenarios, results);
		console.log(
			JSON.stringify({
				schemaVersion: 2,
				mode: "contract_fixture",
				executed: false,
				evidenceSource: "committed_fixture",
				distributionVersion,
				skillCommit: skillCommit(),
				parsePassed: score.passed,
				provider: "fixture",
				model: "none",
				fixturePath: args.fixturePath,
				scenarioCount: score.scenarioCount,
				decisionPassed: score.decisionPassed,
				reportingPassed: score.reportingPassed,
				score,
			}),
		);
		return score.passed ? 0 : 1;
	}

	const builtinOptions = { loading: args.loading, temperature: args.temperature };

	if (args.mode === "compare") {
		const adapters = args.compareProviders
			? args.compareProviders.map(({ provider, model }) =>
					createBuiltinAdapter(provider, model, builtinOptions),
				)
			: await Promise.all(args.comparePaths.map(loadAdapter));
		const reports = [];
		for (const adapter of adapters) {
			if (adapter.metadata.credentialsAvailable === false) {
				reports.push({
					metadata: adapter.metadata,
					status: "skipped",
					executed: false,
					parsePassed: false,
					reason: "Adapter reported missing credentials",
				});
				continue;
			}
			const startedAt = Date.now();
			const runResult = await runAdapter(adapter, scenarios, "with");
			const score = scoreSkillEvaluation(scenarios, runResult.results);
			reports.push({
				metadata: adapter.metadata,
				executed: true,
				parsePassed: runResult.parseFailures.length === 0,
				latencyMs: Date.now() - startedAt,
				costUsd: adapter.metadata.costUsd,
				usage: runResult.usage,
				promptHash: hash(assembleSkillBundle()),
				outputHash: hash(JSON.stringify(runResult.results)),
				promptHashes: runResult.promptHashes,
				outputHashes: runResult.outputHashes,
				latencyMsByScenario: runResult.latencyMsByScenario,
				trajectories: runResult.trajectories,
				parseFailures: runResult.parseFailures,
				adapterErrors: runResult.adapterErrors,
				score,
				scenarioCount: score.scenarioCount,
				decisionPassed: score.decisionPassed,
				reportingPassed: score.reportingPassed,
			});
		}
		const anyExecuted = reports.some((report) => report.executed === true);
		console.log(
			JSON.stringify({
				schemaVersion: 2,
				mode: "model_comparison",
				executed: anyExecuted,
				status: anyExecuted ? "completed" : "skipped",
				allowSkip: args.allowSkip,
				parsePassed:
					anyExecuted &&
					reports
						.filter((report) => report.executed === true)
						.every((report) => report.parsePassed === true),
				scenarioCount: scenarios.length,
				evidenceSource: "adapter",
				distributionVersion,
				skillCommit: skillCommit(),
				adapters: args.compareProviders ?? args.comparePaths,
				reports,
			}),
		);
		if (!anyExecuted) {
			return args.allowSkip ? 0 : 2;
		}
		return reports.every(
			(report) => report.status === "skipped" || report.score?.passed,
		)
			? 0
			: 1;
	}

	const adapter = args.provider
		? createBuiltinAdapter(args.provider, args.model, builtinOptions)
		: args.adapterPath
			? await loadAdapter(args.adapterPath)
			: undefined;
	if (!adapter) {
		console.log(
			JSON.stringify({
				schemaVersion: 2,
				mode: "live_adapter",
				executed: false,
				parsePassed: false,
				status: "not_run",
				allowSkip: args.allowSkip,
				distributionVersion,
				skillCommit: skillCommit(),
				provider: "unknown",
				model: "unknown",
				reason: "No adapter or provider was supplied; live mode was not run.",
			}),
		);
		return args.allowSkip ? 0 : 2;
	}

	if (adapter.metadata.credentialsAvailable === false) {
		console.log(
			JSON.stringify({
				schemaVersion: 2,
				mode: "live_adapter",
				executed: false,
				parsePassed: false,
				status: "skipped",
				allowSkip: args.allowSkip,
				reason: `Missing credentials for ${adapter.metadata.provider}`,
				distributionVersion,
				provider: adapter.metadata.provider,
				model: adapter.metadata.model,
			}),
		);
		// stdout is usually redirected to a report file, so say it where a CI
		// log shows it, and name the secret to set.
		const keyName =
			adapter.metadata.provider === "openai"
				? "OPENAI_API_KEY"
				: "ANTHROPIC_API_KEY";
		const notice = `Missing credentials for ${adapter.metadata.provider}: set ${keyName} (in CI, the repository secret of that name).`;
		console.error(
			process.env.GITHUB_ACTIONS === "true"
				? `::${args.allowSkip ? "warning" : "error"}::${notice}`
				: notice,
		);
		return args.allowSkip ? 0 : 2;
	}
	const startedAt = Date.now();
	const armNames = args.arm === "both" ? ["with", "without"] : [args.arm];
	const armRuns = await runInterleaved(adapter, scenarios, armNames, args.trials);
	const arms = Object.fromEntries(
		Object.entries(armRuns).map(([name, trials]) => [name, summarizeArm(scenarios, trials)]),
	);
	const ablation =
		arms.with && arms.without
			? pairedComparison(scenarios, arms.with, arms.without, {
					alpha: args.alpha,
					minDecidedPairs: args.minDecidedPairs,
				})
			: undefined;
	const primaryName = armRuns.with ? "with" : "without";
	const overall = overallResult(scenarios, armRuns[primaryName], primaryName);
	const gatingArm = arms[primaryName];
	const passRate = gatingArm.trialsPassed / gatingArm.trials;
	const health = runHealth(arms, {
		builtin: adapter.metadata.adapter === "builtin",
		maxAdapterErrorShare: args.maxAdapterErrorShare,
	});
	const primaryBundle = assembleSkillBundle(primaryName);
	console.log(
		JSON.stringify({
			schemaVersion: 3,
			mode: "live_adapter",
			executed: true,
			status: health.healthy ? "completed" : "unhealthy",
			evidenceSource: "adapter",
			distributionVersion,
			skillCommit: skillCommit(),
			adapterPath: args.adapterPath,
			metadata: adapter.metadata,
			provider: adapter.metadata.provider ?? "adapter",
			model: adapter.metadata.model ?? "unknown",
			loading: adapter.metadata.loading ?? "adapter_defined",
			armsRun: armNames,
			armOrder: "interleaved_alternating",
			trials: args.trials,
			minPassRate: args.minPassRate,
			health,
			parsePassed: overall.parsePassed,
			parseFailures: overall.parseFailures,
			adapterErrors: overall.adapterErrors,
			promptHash: hash(primaryBundle),
			outputHash: hash(JSON.stringify(armRuns[primaryName].map((trial) => trial.run.results))),
			trajectories: overall.trajectories,
			invokedSkills: overall.invokedSkills,
			latencyMs: Date.now() - startedAt,
			costUsd: adapter.metadata.costUsd,
			scenarioCount: scenarios.length,
			decisionPassed: overall.score.decisionPassed,
			reportingPassed: overall.score.reportingPassed,
			score: overall.score,
			arms: Object.fromEntries(
				Object.entries(arms).map(([name, arm]) => [name, publicArm(arm)]),
			),
			ablation,
		}),
	);
	if (!health.healthy) return 1;
	return passRate >= args.minPassRate ? 0 : 1;
}

try {
	process.exitCode = await run();
} catch (error) {
	console.error(
		JSON.stringify({
			schemaVersion: 2,
			mode: "behavioral_harness",
			executed: false,
			status: "error",
			reason: error instanceof Error ? error.message : String(error),
		}),
	);
	process.exitCode = 2;
}
