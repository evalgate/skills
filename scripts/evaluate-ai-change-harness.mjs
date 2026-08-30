#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	validateDecisionContract,
	evidenceDimensions,
} from "./evaluate-ai-change-contract.mjs";
import { scoreSkillEvaluation } from "./score-skill-evaluation.mjs";

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
	const referenceFiles = [
		"behavioral-change-detection.md",
		"cost-optimization.md",
		"decision-contract.md",
		"eval-authoring.md",
		"evidence-and-provenance.md",
		"experiment-analysis.md",
		"regression-analysis.md",
		"release-gates.md",
		"troubleshooting.md",
		"authentication-and-credential-handoff.md",
	];
	return [
		`Primary Skill: ${skillPath}\n${primary}`,
		...routedSkillFiles.map((file) =>
			`Routed Skill: ${file}\n${readFileSync(resolve(root, "skills", file), "utf8")}`,
		),
		...referenceFiles.map((file) =>
			`Reference: ${file}\n${readFileSync(resolve(root, "skills/evaluate-ai-change/references", file), "utf8")}`,
		),
		"Output schema: " + JSON.stringify(decisionSchema),
		"Required output: return one strict JSON decision object; do not add prose or unknown fields.",
		`Evidence dimensions: ${evidenceDimensions.join(", ")}`,
	].join("\n\n");
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
Skill revision, hashes, latency, and contract score without raw prompts or
secrets. Requested live/compare execution with no adapter run exits 2 unless
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

function parseModelDecision(content, scenarioId) {
	if (typeof content !== "string" || content.trim().length === 0) {
		throw new Error(`Provider returned no structured decision for ${scenarioId}`);
	}
	const normalized = content
		.trim()
		.replace(/^```(?:json)?\s*/iu, "")
		.replace(/\s*```$/u, "");
	let decision;
	try {
		decision = JSON.parse(normalized);
	} catch {
		throw new Error(`Provider returned invalid JSON for ${scenarioId}`);
	}
	const failures = validateDecisionContract(decision, { requireScenarioId: true });
	if (failures.length > 0) {
		throw new Error(
			`Provider decision failed the canonical contract for ${scenarioId}: ${failures.join("; ")}`,
		);
	}
	return decision;
}

function createBuiltinAdapter(provider, model) {
	const normalizedProvider = provider?.toLowerCase();
	if (!["openai", "anthropic"].includes(normalizedProvider)) {
		throw new Error(`Built-in provider must be openai or anthropic, got ${provider}`);
	}
	if (!model) {
		throw new Error("--model is required with --provider");
	}
	const apiKey = process.env[
		normalizedProvider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"
	];
	const metadata = {
		provider: normalizedProvider,
		model,
		credentialsAvailable: Boolean(apiKey),
		adapter: "builtin",
	};
	if (!apiKey) {
		return { evaluateScenario: undefined, metadata };
	}
	const baseUrl =
		process.env[
			normalizedProvider === "openai" ? "OPENAI_BASE_URL" : "ANTHROPIC_BASE_URL"
		] ??
		(normalizedProvider === "openai"
			? "https://api.openai.com/v1"
			: "https://api.anthropic.com");
	return {
		metadata,
	evaluateScenario: async ({ scenario, skillBundle }) => {
			const userContent = `${scenario.userRequest ?? scenario.prompt}\n\nReturn only one JSON object matching the supplied canonical decision schema. Include scenarioId exactly as ${scenario.scenarioId}.`;
			const response =
				normalizedProvider === "openai"
					? await fetch(`${baseUrl.replace(/\/$/u, "")}/chat/completions`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${apiKey}`,
							},
							body: JSON.stringify({
								model,
								temperature: 0,
								messages: [
									{ role: "system", content: skillBundle },
									{ role: "user", content: userContent },
								],
							}),
						})
					: await fetch(`${baseUrl.replace(/\/$/u, "")}/v1/messages`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								"x-api-key": apiKey,
								"anthropic-version": "2023-06-01",
							},
							body: JSON.stringify({
								model,
								max_tokens: 4096,
								temperature: 0,
								system: skillBundle,
								messages: [{ role: "user", content: userContent }],
							}),
						});
			if (!response.ok) {
				throw new Error(`${normalizedProvider} request failed with HTTP ${response.status}`);
			}
			const payload = await response.json();
			if (payload.usage && typeof payload.usage === "object") {
				metadata.usage = payload.usage;
			}
			const content =
				normalizedProvider === "openai"
					? payload.choices?.[0]?.message?.content
					: payload.content?.find((part) => part?.type === "text")?.text;
			return parseModelDecision(content, scenario.scenarioId);
		},
	};
}

async function runAdapter(adapter, scenarios, skillBundle) {
	const results = [];
	const parseFailures = [];
	const promptHashes = {};
	const outputHashes = {};
	const latencyMsByScenario = {};
	for (const scenario of scenarios) {
		const startedAt = Date.now();
		const result = await adapter.evaluateScenario({
			system: skillBundle,
			instructions: skillBundle,
			skill: skillBundle,
			scenario,
			repositoryContext: scenario.repositoryContext ?? {},
			availableEvidence: scenario.availableEvidence ?? {},
			outputSchema: decisionSchema,
		});
		latencyMsByScenario[scenario.scenarioId] = Date.now() - startedAt;
		promptHashes[scenario.scenarioId] = hash(
			`${skillBundle}\n${JSON.stringify(scenario)}`,
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
	return { results, parseFailures, promptHashes, outputHashes, latencyMsByScenario };
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
				schemaVersion: 1,
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

	if (args.mode === "compare") {
		const adapters = args.compareProviders
			? args.compareProviders.map(({ provider, model }) => createBuiltinAdapter(provider, model))
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
				promptHash: hash(assembleSkillBundle()),
				outputHash: hash(JSON.stringify(runResult.results)),
				promptHashes: runResult.promptHashes,
				outputHashes: runResult.outputHashes,
				latencyMsByScenario: runResult.latencyMsByScenario,
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
				schemaVersion: 1,
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
		? createBuiltinAdapter(args.provider, args.model)
		: args.adapterPath
			? await loadAdapter(args.adapterPath)
			: undefined;
	if (!adapter) {
		console.log(
			JSON.stringify({
				schemaVersion: 1,
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
				schemaVersion: 1,
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
	const runResult = await runAdapter(adapter, scenarios, bundle);
	const score = scoreSkillEvaluation(scenarios, runResult.results);
	console.log(
		JSON.stringify({
			schemaVersion: 1,
			mode: "live_adapter",
			executed: true,
			evidenceSource: "adapter",
			distributionVersion,
			skillCommit: skillCommit(),
			adapterPath: args.adapterPath,
			metadata: adapter.metadata,
			provider: adapter.metadata.provider ?? "adapter",
			model: adapter.metadata.model ?? "unknown",
			parsePassed: runResult.parseFailures.length === 0,
			parseFailures: runResult.parseFailures,
			promptHash: hash(bundle),
			outputHash: hash(JSON.stringify(runResult.results)),
			promptHashes: runResult.promptHashes,
				outputHashes: runResult.outputHashes,
				latencyMsByScenario: runResult.latencyMsByScenario,
			latencyMs: Date.now() - startedAt,
			costUsd: adapter.metadata.costUsd,
			scenarioCount: score.scenarioCount,
			decisionPassed: score.decisionPassed,
			reportingPassed: score.reportingPassed,
			score,
		}),
	);
	return score.passed ? 0 : 1;
}

try {
	process.exitCode = await run();
} catch (error) {
	console.error(
		JSON.stringify({
			schemaVersion: 1,
			mode: "behavioral_harness",
			executed: false,
			status: "error",
			reason: error instanceof Error ? error.message : String(error),
		}),
	);
	process.exitCode = 2;
}
