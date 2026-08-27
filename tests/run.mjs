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

const root = resolve(import.meta.dirname, "..");

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

const temporaryDirectory = mkdtempSync(join(tmpdir(), "evalgate-skill-score-"));
try {
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
