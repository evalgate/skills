#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateDecisionContract } from "../scripts/evaluate-ai-change-contract.mjs";
import { scoreSkillEvaluation } from "../scripts/score-skill-evaluation.mjs";

const root = resolve(import.meta.dirname, "..");

const scenarios = readFileSync(
	resolve(root, "evaluations/evaluate-ai-change.scenarios.jsonl"),
	"utf8",
)
	.trim()
	.split(/\r?\n/u)
	.map((line) => JSON.parse(line));

function run(args, expectedStatus) {
	const result = spawnSync(process.execPath, args, {
		cwd: root,
		encoding: "utf8",
	});
	if (result.status !== expectedStatus) {
		throw new Error(
			`Expected status ${expectedStatus}, got ${result.status}\n${result.stdout}\n${result.stderr}`,
		);
	}
	return result;
}

const notMeasuredEvidenceSummary = Object.fromEntries(
	["quality", "protectedSlices", "reliability", "latency", "cost"].map(
		(dimension) => [
			dimension,
			{ status: "not_measured", reason: "This contract test has no measurements." },
		],
	),
);

run(["scripts/validate-distribution.mjs"], 0);
run(
	[
		"scripts/score-skill-evaluation.mjs",
		"evaluations/fixtures/passing-results.jsonl",
	],
	0,
);
run(
	[
		"scripts/score-skill-evaluation.mjs",
		"evaluations/fixtures/anti-gaming-results.jsonl",
	],
	1,
);
const fixtureHarness = run(["scripts/evaluate-ai-change-harness.mjs"], 0);
const fixtureHarnessReport = JSON.parse(fixtureHarness.stdout);
assert.equal(fixtureHarnessReport.mode, "contract_fixture");
assert.equal(fixtureHarnessReport.executed, false);
// A floor, so adding coverage does not require editing this assertion, while
// silently losing scenarios still fails.
assert.ok(
	fixtureHarnessReport.score.scenarioCount >= 36,
	`expected at least 36 scenarios, got ${fixtureHarnessReport.score.scenarioCount}`,
);
assert.equal(fixtureHarnessReport.score.passed, true);
assert.equal(fixtureHarnessReport.parsePassed, true);
assert.equal(fixtureHarnessReport.distributionVersion, "1.2.0");
const liveWithoutAdapter = run(
	["scripts/evaluate-ai-change-harness.mjs", "--mode", "live"],
	2,
);
const liveWithoutAdapterReport = JSON.parse(liveWithoutAdapter.stdout);
assert.equal(liveWithoutAdapterReport.status, "not_run");
assert.equal(liveWithoutAdapterReport.allowSkip, false);
const liveWithoutAdapterAllowed = run(
	["scripts/evaluate-ai-change-harness.mjs", "--mode", "live", "--allow-skip"],
	0,
);
const liveWithoutAdapterAllowedReport = JSON.parse(liveWithoutAdapterAllowed.stdout);
assert.equal(liveWithoutAdapterAllowedReport.status, "not_run");
assert.equal(liveWithoutAdapterAllowedReport.allowSkip, true);

assert.deepEqual(
	validateDecisionContract({
		invokeEvalGate: true,
		classification: "regression",
		releaseDecision: "block",
		actions: ["fix_implementation"],
		evidenceSummary: notMeasuredEvidenceSummary,
	}),
	[],
);
assert.match(
	validateDecisionContract({
		invokeEvalGate: true,
		classification: "needs_evals",
		releaseDecision: "evaluate",
		actions: [],
		evidenceSummary: notMeasuredEvidenceSummary,
	}).join("\n"),
	/unknown classification/u,
);
assert.match(
	validateDecisionContract({
		invokeEvalGate: true,
		classification: "regression",
		releaseDecision: "promote",
		actions: [],
		evidenceSummary: notMeasuredEvidenceSummary,
	}).join("\n"),
	/requires releaseDecision block/u,
);

const structurallyValidEvidence = {
	quality: {
		status: "measured",
		summary: "Measured quality.",
		measurements: [{ name: "score", value: 1 }],
	},
	protectedSlices: {
		status: "not_measured",
		reason: "No protected slice was supplied.",
	},
	reliability: {
		status: "not_measured",
		reason: "No reliability evidence was supplied.",
	},
	latency: {
		status: "not_measured",
		reason: "No latency evidence was supplied.",
	},
	cost: {
		status: "not_measured",
		reason: "No cost evidence was supplied.",
	},
};
const duplicateMeasurementDecision = {
	scenarioId: "duplicate-evidence",
	invokeEvalGate: true,
	classification: "regression",
	releaseDecision: "block",
	actions: ["fix_implementation"],
	evidenceSummary: {
		...structurallyValidEvidence,
		quality: {
			...structurallyValidEvidence.quality,
			measurements: [
				{ name: "score", value: 1 },
				{ name: "score", value: 1 },
			],
		},
	},
};
assert.match(
	validateDecisionContract(duplicateMeasurementDecision).join("\n"),
	/measurements\[1\]\.name must be unique/u,
);
const invalidMeasurementDecision = {
	...duplicateMeasurementDecision,
	evidenceSummary: {
		...structurallyValidEvidence,
		quality: {
			...structurallyValidEvidence.quality,
			measurements: [{ name: "score", value: true }],
		},
	},
};
assert.match(
	validateDecisionContract(invalidMeasurementDecision).join("\n"),
	/\.value must be a number or string/u,
);

const passingResults = readFileSync(
	resolve(root, "evaluations/fixtures/passing-results.jsonl"),
	"utf8",
)
	.trim()
	.split(/\r?\n/u)
	.map((line) => JSON.parse(line));
const antiGamingResult = passingResults.find(
	(result) => result.scenarioId === "unrelated-code-change",
);
const universalAntiGamingReport = scoreSkillEvaluation(scenarios, [
	...passingResults.filter(
		(result) => result.scenarioId !== "unrelated-code-change",
	),
	{
		...antiGamingResult,
		actions: [...antiGamingResult.actions, "move_baseline"],
	},
]);
assert.equal(universalAntiGamingReport.decisionPassed, false);
assert.ok(
	universalAntiGamingReport.decisionFailures.some(
		(failure) =>
			failure.scenarioId === "unrelated-code-change" &&
			failure.reason === "universal_anti_gaming_action",
	),
);
const duplicateScenarioReport = scoreSkillEvaluation(scenarios, [
	...passingResults,
	passingResults[0],
]);
assert.ok(
	duplicateScenarioReport.decisionFailures.some(
		(failure) =>
			failure.scenarioId === passingResults[0].scenarioId &&
			failure.reason === "duplicate_result",
	),
);
const promotedWithoutEvidence = JSON.parse(
	JSON.stringify(
		passingResults.find((result) => result.scenarioId === "validated-improvement"),
	),
);
promotedWithoutEvidence.evidenceSummary.quality = {
	status: "not_measured",
	reason: "test omission",
};
const missingPromotionEvidenceReport = scoreSkillEvaluation(
	scenarios,
	passingResults.map((result) =>
		result.scenarioId === promotedWithoutEvidence.scenarioId
			? promotedWithoutEvidence
			: result,
	),
);
assert.ok(
	missingPromotionEvidenceReport.decisionFailures.some(
		(failure) => failure.reason === "promote_without_required_evidence",
	),
);
const providerFailurePromotion = JSON.parse(
	JSON.stringify(
		passingResults.find((result) => result.scenarioId === "validated-improvement"),
	),
);
providerFailurePromotion.evidenceSummary.reliability.measurements = [
	{ name: "provider_execution_state", value: "provider_unavailable" },
];
const providerPromotionReport = scoreSkillEvaluation(
	scenarios,
	passingResults.map((result) =>
		result.scenarioId === providerFailurePromotion.scenarioId
			? providerFailurePromotion
			: result,
	),
);
assert.ok(
	providerPromotionReport.decisionFailures.some(
		(failure) => failure.reason === "promote_on_provider_failure",
	),
);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "evalgate-skill-score-"));
try {
	const fixturePath = resolve(root, "evaluations/fixtures/passing-results.jsonl");
	const bundleMarkerPath = join(temporaryDirectory, "bundle-marker.json");
	const adapterSource = (provider, model) => `
import { readFileSync, writeFileSync } from "node:fs";
const rows = readFileSync(${JSON.stringify(fixturePath)}, "utf8")
  .trim().split(/\\r?\\n/u).map((line) => JSON.parse(line));
const byId = new Map(rows.map((row) => [row.scenarioId, row]));
export const metadata = ${JSON.stringify({ provider, model })};
export function evaluateScenario({ scenario, skill }) {
  if (!globalThis.__bundleMarkerWritten) {
    writeFileSync(${JSON.stringify(bundleMarkerPath)}, JSON.stringify({
      setup: skill.includes("name: setup-evalgate-project"),
      gate: skill.includes("name: run-regression-gate"),
      traces: skill.includes("name: collect-agent-traces"),
      repository: skill.includes("name: ask-repository-question"),
      mcp: skill.includes("name: use-evalgate-mcp"),
    }));
    globalThis.__bundleMarkerWritten = true;
  }
  return byId.get(scenario.scenarioId);
}
`;
	const missingCredentialsSource = `
export const metadata = { provider: "test-provider", model: "test-model", credentialsAvailable: false };
export function evaluateScenario() { throw new Error("must not execute without credentials"); }
`;
	const adapterAPath = join(temporaryDirectory, "adapter-a.mjs");
	const adapterBPath = join(temporaryDirectory, "adapter-b.mjs");
	const missingCredentialsPath = join(temporaryDirectory, "missing-credentials.mjs");
	writeFileSync(adapterAPath, adapterSource("provider-a", "model-a"));
	writeFileSync(adapterBPath, adapterSource("provider-b", "model-b"));
	writeFileSync(missingCredentialsPath, missingCredentialsSource);
	const comparison = run(
		[
			"scripts/evaluate-ai-change-harness.mjs",
			"--compare",
			`${adapterAPath},${adapterBPath}`,
		],
		0,
	);
	const comparisonReport = JSON.parse(comparison.stdout);
	assert.equal(comparisonReport.mode, "model_comparison");
	assert.equal(comparisonReport.executed, true);
	assert.ok(comparisonReport.reports.every((report) => report.parsePassed));
	assert.deepEqual(
		comparisonReport.reports.map((report) => report.metadata.provider),
		["provider-a", "provider-b"],
	);
	assert.deepEqual(JSON.parse(readFileSync(bundleMarkerPath, "utf8")), {
		setup: true,
		gate: true,
		traces: true,
		repository: true,
		mcp: true,
	});

	const skippedLive = run(
		[
			"scripts/evaluate-ai-change-harness.mjs",
			"--mode",
			"live",
			"--adapter",
			missingCredentialsPath,
		],
		2,
	);
	const skippedLiveReport = JSON.parse(skippedLive.stdout);
	assert.equal(skippedLiveReport.status, "skipped");
	assert.equal(skippedLiveReport.executed, false);
	assert.equal(skippedLiveReport.allowSkip, false);
	const allowedSkippedLive = run(
		[
			"scripts/evaluate-ai-change-harness.mjs",
			"--mode",
			"live",
			"--adapter",
			missingCredentialsPath,
			"--allow-skip",
		],
		0,
	);
	assert.equal(JSON.parse(allowedSkippedLive.stdout).allowSkip, true);
	const skippedComparison = run(
		[
			"scripts/evaluate-ai-change-harness.mjs",
			"--compare",
			`${missingCredentialsPath},${missingCredentialsPath}`,
		],
		2,
	);
	const skippedComparisonReport = JSON.parse(skippedComparison.stdout);
	assert.equal(skippedComparisonReport.executed, false);
	assert.equal(skippedComparisonReport.status, "skipped");
	assert.equal(skippedComparisonReport.allowSkip, false);
	const allowedSkippedComparison = run(
		[
			"scripts/evaluate-ai-change-harness.mjs",
			"--compare",
			`${missingCredentialsPath},${missingCredentialsPath}`,
			"--allow-skip",
		],
		0,
	);
	assert.equal(JSON.parse(allowedSkippedComparison.stdout).allowSkip, true);

	const results = readFileSync(
		resolve(root, "evaluations/fixtures/passing-results.jsonl"),
		"utf8",
	)
		.trim()
		.split(/\r?\n/u)
		.map((line) => JSON.parse(line));
	const mixedBugSweep = results.find(
		(result) => result.scenarioId === "mixed-bug-sweep",
	);
	mixedBugSweep.evidenceSummary.latency = {
		status: "not_measured",
		reason: "Incorrectly omitted supplied latency evidence.",
	};
	mixedBugSweep.evidenceSummary.cost = {
		status: "not_measured",
		reason: "Incorrectly omitted supplied cost evidence.",
	};
	const incompletePath = join(temporaryDirectory, "incomplete-reporting.jsonl");
	writeFileSync(
		incompletePath,
		`${results.map((result) => JSON.stringify(result)).join("\n")}\n`,
	);
	const scored = run(
		["scripts/score-skill-evaluation.mjs", incompletePath, "--json"],
		1,
	);
	const report = JSON.parse(scored.stdout);
	assert.equal(report.decisionPassed, true);
	assert.equal(report.reportingPassed, false);
	assert.equal(report.decisionFailureCount, 0);
	assert.deepEqual(
		report.reportingFailures
			.filter((failure) => failure.reason === "wrong_evidence_status")
			.map((failure) => failure.dimension)
			.sort(),
		["cost", "latency"],
	);
} finally {
	rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("PASS: distribution and positive/negative skill evaluation fixtures");
