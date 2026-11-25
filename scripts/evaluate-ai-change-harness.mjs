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
	discoverSkillDirectories,
	noiseBand,
	progressiveSystemPrompt,
	runAgentTask,
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

function assembleSkillBundle() {
	const primary = readFileSync(skillPath, "utf8");
	const routedSkillFiles = [
		"setup-evalgate-project/SKILL.md",
		"run-regression-gate/SKILL.md",
		"collect-agent-traces/SKILL.md",
		"ask-repository-question/SKILL.md",
		"use-evalgate-mcp/SKILL.md",
	];
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

function skillSections(primary, routedSkillFiles, referenceFiles) {
	return [
		`Primary Skill: ${skillPath}\n${primary}`,
		...routedSkillFiles.map((file) =>
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
and removes only the evaluated skill, so a difference is attributable to it.
A with/without difference inside the noise band is not evidence of lift.
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
				: arm === "without"
					? contract
					: bundleSystemPrompt([assembleSkillBundle()], "");
			const run = await runAgentTask({ chat, system, userContent, catalog, progressive });
			if (run.error) {
				const error = new Error(`Agent run for ${scenario.scenarioId} ended with ${run.error}`);
				error.agentRun = run;
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

async function runAdapter(adapter, scenarios, skillBundle, arm = "with") {
	const results = [];
	const parseFailures = [];
	const promptHashes = {};
	const outputHashes = {};
	const latencyMsByScenario = {};
	const trajectories = {};
	const invokedSkills = {};
	const usage = emptyUsage();
	const armBundle = arm === "without" ? outputContract() : skillBundle;
	for (const scenario of scenarios) {
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
			// One bad model turn must not abort the remaining scenarios: record it
			// as a failure of this scenario and keep measuring.
			latencyMsByScenario[scenario.scenarioId] = Date.now() - startedAt;
			const run = error?.agentRun;
			if (run) {
				trajectories[scenario.scenarioId] = run.trajectory;
				invokedSkills[scenario.scenarioId] = run.invokedSkills;
				for (const key of Object.keys(usage)) usage[key] += run.usage?.[key] ?? 0;
			}
			parseFailures.push({
				scenarioId: scenario.scenarioId,
				reason: "adapter_error",
				detail: error instanceof Error ? error.message : String(error),
			});
			continue;
		}
		latencyMsByScenario[scenario.scenarioId] = Date.now() - startedAt;
		if (result?.__agentRun) {
			trajectories[scenario.scenarioId] = result.trajectory;
			invokedSkills[scenario.scenarioId] = result.invokedSkills;
			for (const key of Object.keys(usage)) usage[key] += result.usage?.[key] ?? 0;
			result = result.decision;
		}
		promptHashes[scenario.scenarioId] = hash(
			`${armBundle}\n${JSON.stringify(scenario)}`,
		);
		outputHashes[scenario.scenarioId] = hash(JSON.stringify(result ?? null));
		if (!result || typeof result !== "object" || Array.isArray(result)) {
			parseFailures.push({
				scenarioId: scenario.scenarioId,
				reason: "non_object_result",
			});
			continue;
		}
		const contractFailures = validateDecisionContract(result, {
			requireScenarioId: true,
		});
		if (contractFailures.length > 0) {
			parseFailures.push({
				scenarioId: scenario.scenarioId,
				reason: "invalid_decision_contract",
				detail: contractFailures,
			});
		}
		results.push(result);
	}
	return {
		results,
		parseFailures,
		promptHashes,
		outputHashes,
		latencyMsByScenario,
		trajectories,
		invokedSkills,
		usage,
	};
}

/** Scenario IDs with no decision or reporting failure in one scored trial. */
function passedScenarioIds(scenarios, score) {
	const failed = new Set(
		[...score.decisionFailures, ...score.reportingFailures].map((failure) => failure.scenarioId),
	);
	return new Set(
		scenarios.map((scenario) => scenario.scenarioId).filter((id) => !failed.has(id)),
	);
}

function summarizeArm(scenarios, trialRuns) {
	const outcomesByCase = new Map(scenarios.map((scenario) => [scenario.scenarioId, []]));
	const usage = emptyUsage();
	let latencyMs = 0;
	for (const trial of trialRuns) {
		const passed = passedScenarioIds(scenarios, trial.score);
		for (const scenario of scenarios) {
			outcomesByCase.get(scenario.scenarioId).push(passed.has(scenario.scenarioId));
		}
		for (const key of Object.keys(usage)) usage[key] += trial.run.usage[key];
		latencyMs += trial.latencyMs;
	}
	const passes = [...outcomesByCase.values()].flat().filter(Boolean).length;
	const total = scenarios.length * trialRuns.length;
	return {
		trials: trialRuns.length,
		trialsPassed: trialRuns.filter((trial) => trial.score.passed).length,
		scenarioPassRate: total === 0 ? null : Number((passes / total).toFixed(4)),
		interval: wilsonInterval(passes, total),
		noiseBand: noiseBand(outcomesByCase),
		usage,
		meanTokensPerScenario:
			total === 0 ? null : Math.round((usage.inputTokens + usage.outputTokens) / total),
		latencyMs,
		outcomesByCase,
	};
}

function pairedComparison(scenarios, withArm, withoutArm) {
	let wins = 0;
	let losses = 0;
	let ties = 0;
	const byScenario = {};
	for (const scenario of scenarios) {
		const rate = (outcomes) => outcomes.filter(Boolean).length / outcomes.length;
		const withRate = rate(withArm.outcomesByCase.get(scenario.scenarioId));
		const withoutRate = rate(withoutArm.outcomesByCase.get(scenario.scenarioId));
		const outcome = withRate > withoutRate ? "win" : withRate < withoutRate ? "loss" : "tie";
		if (outcome === "win") wins++;
		else if (outcome === "loss") losses++;
		else ties++;
		byScenario[scenario.scenarioId] = { withRate, withoutRate, outcome };
	}
	const difference = Number(
		((withArm.scenarioPassRate ?? 0) - (withoutArm.scenarioPassRate ?? 0)).toFixed(4),
	);
	const band = Math.max(withArm.noiseBand ?? 0, withoutArm.noiseBand ?? 0);
	const decided = wins + losses;
	return {
		difference,
		wins,
		losses,
		ties,
		winShare: decided === 0 ? null : Number((wins / decided).toFixed(4)),
		winShareInterval: wilsonInterval(wins, decided),
		noiseBand: withArm.noiseBand === null && withoutArm.noiseBand === null ? null : band,
		liftExceedsNoise:
			withArm.noiseBand === null && withoutArm.noiseBand === null
				? null
				: Math.abs(difference) > band,
		tokenDelta:
			withArm.meanTokensPerScenario === null || withoutArm.meanTokensPerScenario === null
				? null
				: withArm.meanTokensPerScenario - withoutArm.meanTokensPerScenario,
		byScenario,
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
			const runResult = await runAdapter(adapter, scenarios, assembleSkillBundle());
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
		return args.allowSkip ? 0 : 2;
	}
	const startedAt = Date.now();
	const bundle = assembleSkillBundle();
	const armNames = args.arm === "both" ? ["with", "without"] : [args.arm];
	const armRuns = {};
	for (const armName of armNames) {
		armRuns[armName] = [];
		for (let trial = 1; trial <= args.trials; trial++) {
			const trialStartedAt = Date.now();
			const runResult = await runAdapter(adapter, scenarios, bundle, armName);
			armRuns[armName].push({
				trial,
				run: runResult,
				score: scoreSkillEvaluation(scenarios, runResult.results),
				latencyMs: Date.now() - trialStartedAt,
			});
		}
	}
	const arms = Object.fromEntries(
		Object.entries(armRuns).map(([name, trials]) => [name, summarizeArm(scenarios, trials)]),
	);
	const ablation =
		arms.with && arms.without ? pairedComparison(scenarios, arms.with, arms.without) : undefined;
	const primaryArm = armRuns.with ?? armRuns.without;
	const first = primaryArm[0];
	const gatingArm = arms.with ?? arms.without;
	const passRate = gatingArm.trialsPassed / gatingArm.trials;
	console.log(
		JSON.stringify({
			schemaVersion: 2,
			mode: "live_adapter",
			executed: true,
			evidenceSource: "adapter",
			distributionVersion,
			skillCommit: skillCommit(),
			adapterPath: args.adapterPath,
			metadata: adapter.metadata,
			provider: adapter.metadata.provider ?? "adapter",
			model: adapter.metadata.model ?? "unknown",
			loading: adapter.metadata.loading ?? "adapter_defined",
			armsRun: armNames,
			trials: args.trials,
			minPassRate: args.minPassRate,
			parsePassed: first.run.parseFailures.length === 0,
			parseFailures: first.run.parseFailures,
			promptHash: hash(bundle),
			outputHash: hash(JSON.stringify(first.run.results)),
			promptHashes: first.run.promptHashes,
			outputHashes: first.run.outputHashes,
			latencyMsByScenario: first.run.latencyMsByScenario,
			trajectories: first.run.trajectories,
			invokedSkills: first.run.invokedSkills,
			latencyMs: Date.now() - startedAt,
			costUsd: adapter.metadata.costUsd,
			scenarioCount: first.score.scenarioCount,
			decisionPassed: first.score.decisionPassed,
			reportingPassed: first.score.reportingPassed,
			score: first.score,
			arms: Object.fromEntries(
				Object.entries(arms).map(([name, arm]) => [name, publicArm(arm)]),
			),
			ablation,
		}),
	);
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
