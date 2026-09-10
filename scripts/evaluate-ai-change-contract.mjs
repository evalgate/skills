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
export const evidenceDimensions = [
	"quality",
	"protectedSlices",
	"reliability",
	"latency",
	"cost",
];

const allowedFields = new Set([
	"scenarioId",
	"invokeEvalGate",
	"classification",
	"releaseDecision",
	"actions",
	"evidenceSummary",
	// Which skill the request was routed to, and any authority the route
	// asked for. Optional: a decision result that reports neither is still a
	// valid contract, so existing scenarios are unaffected.
	"routedSkill",
	"requestedAuthority",
]);

export function validateDecisionCore(value, { requireScenarioId = false } = {}) {
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

export function validateEvidenceSummary(evidenceSummary) {
	const failures = [];
	if (
		!evidenceSummary ||
		typeof evidenceSummary !== "object" ||
		Array.isArray(evidenceSummary)
	) {
		return ["evidenceSummary must be an object"];
	}
	for (const dimensionName of evidenceDimensions) {
		const dimension = evidenceSummary[dimensionName];
		if (!dimension || typeof dimension !== "object" || Array.isArray(dimension)) {
			failures.push(`evidenceSummary.${dimensionName} must be an object`);
			continue;
		}
		if (dimension.status === "not_measured") {
			if (typeof dimension.reason !== "string" || dimension.reason.length === 0) {
				failures.push(
					`evidenceSummary.${dimensionName}.reason must explain why it was not measured`,
				);
			}
			for (const field of Object.keys(dimension)) {
				if (!["status", "reason"].includes(field)) {
					failures.push(
						`evidenceSummary.${dimensionName} has unknown field: ${field}`,
					);
				}
			}
			continue;
		}
		if (dimension.status !== "measured") {
			failures.push(
				`evidenceSummary.${dimensionName}.status must be measured or not_measured`,
			);
			continue;
		}
		if (typeof dimension.summary !== "string" || dimension.summary.length === 0) {
			failures.push(
				`evidenceSummary.${dimensionName}.summary must be a non-empty string`,
			);
		}
		if (!Array.isArray(dimension.measurements) || dimension.measurements.length === 0) {
			failures.push(
				`evidenceSummary.${dimensionName}.measurements must be non-empty`,
			);
		} else {
			const measurementNames = new Set();
			for (const [index, measurement] of dimension.measurements.entries()) {
				if (!measurement || typeof measurement !== "object" || Array.isArray(measurement)) {
					failures.push(
						`evidenceSummary.${dimensionName}.measurements[${index}] must be an object`,
					);
					continue;
				}
				if (typeof measurement.name !== "string" || measurement.name.length === 0) {
					failures.push(
						`evidenceSummary.${dimensionName}.measurements[${index}].name is required`,
					);
				}
				if (measurementNames.has(measurement.name)) {
					failures.push(
						`evidenceSummary.${dimensionName}.measurements[${index}].name must be unique`,
					);
				}
				measurementNames.add(measurement.name);
				if (
					!["baseline", "candidate", "delta", "value", "passed"].some(
						(field) => field in measurement,
					)
				) {
					failures.push(
						`evidenceSummary.${dimensionName}.measurements[${index}] has no measured value`,
					);
				}
				for (const field of ["baseline", "candidate", "delta", "value", "threshold"]) {
					if (
						field in measurement &&
						(typeof measurement[field] !== "number" &&
							typeof measurement[field] !== "string")
					) {
						failures.push(
							`evidenceSummary.${dimensionName}.measurements[${index}].${field} must be a number or string`,
						);
					}
					if (
						typeof measurement[field] === "number" &&
						!Number.isFinite(measurement[field])
					) {
						failures.push(
							`evidenceSummary.${dimensionName}.measurements[${index}].${field} must be finite`,
						);
					}
				}
				if ("passed" in measurement && typeof measurement.passed !== "boolean") {
					failures.push(
						`evidenceSummary.${dimensionName}.measurements[${index}].passed must be a boolean`,
					);
				}
				for (const field of Object.keys(measurement)) {
					if (
						![
							"name",
							"baseline",
							"candidate",
							"delta",
							"value",
							"unit",
							"threshold",
							"passed",
							"source",
						].includes(field)
					) {
						failures.push(
							`evidenceSummary.${dimensionName}.measurements[${index}] has unknown field: ${field}`,
						);
					}
				}
			}
		}
		for (const field of Object.keys(dimension)) {
			if (!["status", "summary", "measurements"].includes(field)) {
				failures.push(
					`evidenceSummary.${dimensionName} has unknown field: ${field}`,
				);
			}
		}
	}
	for (const field of Object.keys(evidenceSummary)) {
		if (!evidenceDimensions.includes(field)) {
			failures.push(`evidenceSummary has unknown dimension: ${field}`);
		}
	}
	return failures;
}

export function validateDecisionContract(value, options = {}) {
	return [
		...validateDecisionCore(value, options),
		...validateEvidenceSummary(value?.evidenceSummary),
	];
}
