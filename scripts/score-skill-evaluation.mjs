#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateDecisionContract } from "./evaluate-ai-change-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const scenarioPath = resolve(
	root,
	"evaluations/evaluate-ai-change.scenarios.jsonl",
);
const resultPath = process.argv[2] ? resolve(process.argv[2]) : undefined;
const jsonOutput = process.argv.includes("--json");

if (!resultPath) {
	console.error(
		"Usage: node scripts/score-skill-evaluation.mjs <results.jsonl> [--json]",
	);
	process.exit(2);
}

function readJsonLines(path) {
	return readFileSync(path, "utf8")
		.split(/\r?\n/u)
		.filter((line) => line.trim().length > 0)
		.map((line, index) => {
			try {
				return JSON.parse(line);
			} catch (error) {
				throw new Error(`${path}:${index + 1}: ${error.message}`);
			}
		});
}

const scenarios = readJsonLines(scenarioPath);
const results = new Map(
	readJsonLines(resultPath).map((result) => [result.scenarioId, result]),
);
const failures = [];

for (const scenario of scenarios) {
	const result = results.get(scenario.scenarioId);
	if (!result) {
		failures.push({ scenarioId: scenario.scenarioId, reason: "missing_result" });
		continue;
	}
	for (const failure of validateDecisionContract(result, { requireScenarioId: true })) {
		failures.push({
			scenarioId: scenario.scenarioId,
			reason: "invalid_contract",
			detail: failure,
		});
	}
	const expected = scenario.expected;
	for (const field of ["invokeEvalGate", "classification", "releaseDecision"]) {
		if (result[field] !== expected[field]) {
			failures.push({
				scenarioId: scenario.scenarioId,
				reason: `wrong_${field}`,
				expected: expected[field],
				actual: result[field],
			});
		}
	}
	const actions = new Set(Array.isArray(result.actions) ? result.actions : []);
	for (const action of expected.requiredActions) {
		if (!actions.has(action)) {
			failures.push({
				scenarioId: scenario.scenarioId,
				reason: "missing_required_action",
				action,
			});
		}
	}
	for (const action of expected.prohibitedActions) {
		if (actions.has(action)) {
			failures.push({
				scenarioId: scenario.scenarioId,
				reason: "prohibited_action",
				action,
			});
		}
	}
}

for (const scenarioId of results.keys()) {
	if (!scenarios.some((scenario) => scenario.scenarioId === scenarioId)) {
		failures.push({ scenarioId, reason: "unknown_scenario" });
	}
}

const report = {
	schemaVersion: 1,
	scenarioCount: scenarios.length,
	passed: failures.length === 0,
	failureCount: failures.length,
	failures,
};

if (jsonOutput) {
	console.log(JSON.stringify(report));
} else if (report.passed) {
	console.log(`PASS: ${report.scenarioCount} skill scenarios satisfied`);
} else {
	console.error(
		`FAIL: ${report.failureCount} contract violations across ${report.scenarioCount} scenarios`,
	);
	for (const failure of failures) console.error(JSON.stringify(failure));
}

process.exit(report.passed ? 0 : 1);
