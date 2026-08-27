#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	validateDecisionCore,
	validateEvidenceSummary,
} from "./evaluate-ai-change-contract.mjs";

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
const decisionFailures = [];
const reportingFailures = [];

for (const scenario of scenarios) {
	const result = results.get(scenario.scenarioId);
	if (!result) {
		decisionFailures.push({
			scenarioId: scenario.scenarioId,
			reason: "missing_result",
		});
		reportingFailures.push({
			scenarioId: scenario.scenarioId,
			reason: "missing_result",
		});
		continue;
	}
	for (const failure of validateDecisionCore(result, { requireScenarioId: true })) {
		decisionFailures.push({
			scenarioId: scenario.scenarioId,
			reason: "invalid_decision_contract",
			detail: failure,
		});
	}
	for (const failure of validateEvidenceSummary(result.evidenceSummary)) {
		reportingFailures.push({
			scenarioId: scenario.scenarioId,
			reason: "invalid_evidence_summary",
			detail: failure,
		});
	}
	const expected = scenario.expected;
	for (const field of ["invokeEvalGate", "classification", "releaseDecision"]) {
		if (result[field] !== expected[field]) {
			decisionFailures.push({
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
			decisionFailures.push({
				scenarioId: scenario.scenarioId,
				reason: "missing_required_action",
				action,
			});
		}
	}
	for (const action of expected.prohibitedActions) {
		if (actions.has(action)) {
			decisionFailures.push({
				scenarioId: scenario.scenarioId,
				reason: "prohibited_action",
				action,
			});
		}
	}
	for (const [dimensionName, expectation] of Object.entries(
		expected.evidenceExpectations ?? {},
	)) {
		const dimension = result.evidenceSummary?.[dimensionName];
		if (dimension?.status !== expectation.status) {
			reportingFailures.push({
				scenarioId: scenario.scenarioId,
				reason: "wrong_evidence_status",
				dimension: dimensionName,
				expected: expectation.status,
				actual: dimension?.status,
			});
			continue;
		}
		const measurementNames = new Set(
			Array.isArray(dimension.measurements)
				? dimension.measurements.map((measurement) => measurement.name)
				: [],
		);
		for (const measurementName of expectation.requiredMeasurements ?? []) {
			if (!measurementNames.has(measurementName)) {
				reportingFailures.push({
					scenarioId: scenario.scenarioId,
					reason: "missing_evidence_measurement",
					dimension: dimensionName,
					measurement: measurementName,
				});
			}
		}
	}
}

for (const scenarioId of results.keys()) {
	if (!scenarios.some((scenario) => scenario.scenarioId === scenarioId)) {
		decisionFailures.push({ scenarioId, reason: "unknown_scenario" });
		reportingFailures.push({ scenarioId, reason: "unknown_scenario" });
	}
}

const report = {
	schemaVersion: 1,
	scenarioCount: scenarios.length,
	passed: decisionFailures.length === 0 && reportingFailures.length === 0,
	decisionPassed: decisionFailures.length === 0,
	reportingPassed: reportingFailures.length === 0,
	decisionFailureCount: decisionFailures.length,
	reportingFailureCount: reportingFailures.length,
	decisionFailures,
	reportingFailures,
};

if (jsonOutput) {
	console.log(JSON.stringify(report));
} else if (report.passed) {
	console.log(
		`PASS: ${report.scenarioCount} skill scenarios satisfied decision and reporting contracts`,
	);
} else {
	console.error(
		`FAIL: ${report.decisionFailureCount} decision and ${report.reportingFailureCount} reporting violations across ${report.scenarioCount} scenarios`,
	);
	for (const failure of decisionFailures) {
		console.error(JSON.stringify({ score: "decision", ...failure }));
	}
	for (const failure of reportingFailures) {
		console.error(JSON.stringify({ score: "reporting", ...failure }));
	}
}

process.exit(report.passed ? 0 : 1);
