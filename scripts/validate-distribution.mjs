#!/usr/bin/env node

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
	classifications,
	evidenceDimensions,
	releaseDecisionByClassification,
	releaseDecisions,
	validateDecisionContract,
} from "./evaluate-ai-change-contract.mjs";

const root = resolve(import.meta.dirname, "..");
const skillsRoot = resolve(root, "skills");
const expectedSkills = [
	"ask-repository-question",
	"collect-agent-traces",
	"evaluate-ai-change",
	"run-regression-gate",
	"setup-evalgate-project",
	"use-evalgate-mcp",
];
const failures = [];

const skillNames = readdirSync(skillsRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.sort();

if (JSON.stringify(skillNames) !== JSON.stringify(expectedSkills)) {
	failures.push(`unexpected skills: ${skillNames.join(", ")}`);
}

for (const skillName of skillNames) {
	const skillPath = resolve(skillsRoot, skillName, "SKILL.md");
	const content = readFileSync(skillPath, "utf8");
	const frontmatter = content.match(
		/^---\r?\nname: ([a-z0-9-]+)\r?\ndescription: (.+)\r?\n---/u,
	);
	if (!frontmatter) failures.push(`${skillName}: invalid frontmatter`);
	if (frontmatter?.[1] !== skillName) {
		failures.push(`${skillName}: frontmatter name mismatch`);
	}
	if ((frontmatter?.[2]?.length ?? 0) < 40) {
		failures.push(`${skillName}: description is not discriminating`);
	}
	for (const match of content.matchAll(
		/\[[^\]]+\]\(([^)]+\.(?:json|md))\)/gu,
	)) {
		const target = resolve(dirname(skillPath), match[1]);
		if (!existsSync(target) || !statSync(target).isFile()) {
			failures.push(`${skillName}: missing reference ${match[1]}`);
		}
	}
	if (/BEGIN PRIVATE|(?<![A-Za-z])sk-[A-Za-z0-9]{20,}/u.test(content)) {
		failures.push(`${skillName}: potential private content or secret`);
	}
}

for (const manifestPath of ["plugin.json", "mcp.json", ".mcp.json"]) {
	try {
		JSON.parse(readFileSync(resolve(root, manifestPath), "utf8"));
	} catch (error) {
		failures.push(`${manifestPath}: ${error.message}`);
	}
}

const scenarios = readFileSync(
	resolve(root, "evaluations/evaluate-ai-change.scenarios.jsonl"),
	"utf8",
)
	.split(/\r?\n/u)
	.filter(Boolean)
	.map((line) => JSON.parse(line));

if (scenarios.length !== 11) failures.push(`expected 11 scenarios, got ${scenarios.length}`);
if (new Set(scenarios.map((scenario) => scenario.scenarioId)).size !== 11) {
	failures.push("scenario IDs must be unique");
}
const coveredClassifications = [
	...new Set(scenarios.map((scenario) => scenario.expected.classification)),
];
const coveredReleaseDecisions = [
	...new Set(scenarios.map((scenario) => scenario.expected.releaseDecision)),
];
for (const classification of classifications) {
	if (!coveredClassifications.includes(classification)) {
		failures.push(`scenario coverage omits classification ${classification}`);
	}
}
for (const releaseDecision of releaseDecisions) {
	if (!coveredReleaseDecisions.includes(releaseDecision)) {
		failures.push(`scenario coverage omits releaseDecision ${releaseDecision}`);
	}
}

if (
	JSON.stringify(Object.keys(releaseDecisionByClassification)) !==
	JSON.stringify(classifications)
) {
	failures.push("classification mapping must cover the canonical enum in order");
}

for (const scenario of scenarios) {
	const evidenceSummary = Object.fromEntries(
		evidenceDimensions.map((dimension) => [
			dimension,
			{
				status: "not_measured",
				reason: "Distribution validation does not execute the scenario.",
			},
		]),
	);
	const contractFailures = validateDecisionContract(
		{
			scenarioId: scenario.scenarioId,
			invokeEvalGate: scenario.expected.invokeEvalGate,
			classification: scenario.expected.classification,
			releaseDecision: scenario.expected.releaseDecision,
			actions: scenario.expected.requiredActions,
			evidenceSummary,
		},
		{ requireScenarioId: true },
	);
	for (const failure of contractFailures) {
		failures.push(`${scenario.scenarioId}: ${failure}`);
	}
	for (const [dimension, expectation] of Object.entries(
		scenario.expected.evidenceExpectations ?? {},
	)) {
		if (!evidenceDimensions.includes(dimension)) {
			failures.push(`${scenario.scenarioId}: unknown evidence dimension ${dimension}`);
		}
		if (!["measured", "not_measured"].includes(expectation.status)) {
			failures.push(`${scenario.scenarioId}: invalid evidence status for ${dimension}`);
		}
		if (
			expectation.requiredMeasurements !== undefined &&
			(!Array.isArray(expectation.requiredMeasurements) ||
				expectation.requiredMeasurements.some(
					(name) => typeof name !== "string" || name.length === 0,
				))
		) {
			failures.push(
				`${scenario.scenarioId}: invalid requiredMeasurements for ${dimension}`,
			);
		}
	}
}

if (!scenarios.some((scenario) => scenario.scenarioId === "mixed-bug-sweep")) {
	failures.push("scenario coverage omits mixed-bug-sweep");
}

const primarySkill = readFileSync(
	resolve(skillsRoot, "evaluate-ai-change/SKILL.md"),
	"utf8",
);
for (const classification of classifications) {
	if (!primarySkill.includes(`\`${classification}\``)) {
		failures.push(`primary skill omits canonical classification ${classification}`);
	}
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`FAIL: ${failure}`);
	process.exit(1);
}

console.log(`PASS: ${skillNames.length} skills and ${scenarios.length} scenarios validated`);
