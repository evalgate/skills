import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaPath = resolve(
	import.meta.dirname,
	"../skills/evaluate-ai-change/assets/decision-contract.schema.json",
);

export const decisionSchema = JSON.parse(readFileSync(schemaPath, "utf8"));
export const classifications = decisionSchema.$defs.classification.enum;
export const releaseDecisions = decisionSchema.$defs.releaseDecision.enum;
export const releaseDecisionByClassification =
	decisionSchema["x-releaseDecisionByClassification"];
export const invokeEvalGateByClassification =
	decisionSchema["x-invokeEvalGateByClassification"];

const allowedFields = new Set([
	"scenarioId",
	"invokeEvalGate",
	"classification",
	"releaseDecision",
	"actions",
]);

export function validateDecisionContract(value, { requireScenarioId = false } = {}) {
	const failures = [];
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return ["decision must be an object"];
	}
	for (const field of ["invokeEvalGate", "classification", "releaseDecision", "actions"]) {
		if (!(field in value)) failures.push(`missing ${field}`);
	}
	if (requireScenarioId &&
		(typeof value.scenarioId !== "string" || value.scenarioId.length === 0)) {
		failures.push("scenarioId must be a non-empty string");
	}
	if (typeof value.invokeEvalGate !== "boolean") {
		failures.push("invokeEvalGate must be a boolean");
	}
	if (!classifications.includes(value.classification)) {
		failures.push(`unknown classification: ${String(value.classification)}`);
	}
	if (!releaseDecisions.includes(value.releaseDecision)) {
		failures.push(`unknown releaseDecision: ${String(value.releaseDecision)}`);
	}
	if (!Array.isArray(value.actions) ||
		value.actions.some((action) => typeof action !== "string" || action.length === 0) ||
		new Set(value.actions).size !== value.actions.length) {
		failures.push("actions must be unique non-empty strings");
	}
	if (classifications.includes(value.classification)) {
		const expectedDecision = releaseDecisionByClassification[value.classification];
		if (value.releaseDecision !== expectedDecision) {
			failures.push(
				`${value.classification} requires releaseDecision ${expectedDecision}`,
			);
		}
		const expectedInvocation = invokeEvalGateByClassification[value.classification];
		if (value.invokeEvalGate !== expectedInvocation) {
			failures.push(
				`${value.classification} requires invokeEvalGate ${expectedInvocation}`,
			);
		}
	}
	for (const field of Object.keys(value)) {
		if (!allowedFields.has(field)) failures.push(`unknown field: ${field}`);
	}
	return failures;
}
