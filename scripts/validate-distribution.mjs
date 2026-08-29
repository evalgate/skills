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

const agentInstructions = readFileSync(resolve(root, "AGENTS.md"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
for (const requiredInstruction of [
	"skills/evaluate-ai-change/SKILL.md",
	"decision-contract.schema.json",
	"customer prompts",
	"organization-scoped credential",
	"not_measured",
]) {
	if (!agentInstructions.includes(requiredInstruction)) {
		failures.push(`AGENTS.md omits ${requiredInstruction}`);
	}
}
if (!readme.includes("[`AGENTS.md`]")) {
	failures.push("README.md does not link to AGENTS.md");
}
if (/github\.com\/evalgate\/ai-evaluation-platform/iu.test(agentInstructions)) {
	failures.push("AGENTS.md exposes the private application repository");
}

for (const requiredReadmeText of [
	"https://github.com/evalgate/skills",
	"npx skills add evalgate/skills",
	"--list",
	"skills/evaluate-ai-change/SKILL.md",
	"EvalGate SDK 3.8.x",
	"There is no npm package named `@evalgate/skills`",
	"https://evalgate.com",
	"https://www.evalgate.com/docs/sdk/cli",
]) {
	if (!readme.includes(requiredReadmeText)) {
		failures.push(`README.md omits ${requiredReadmeText}`);
	}
}

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

for (const manifestPath of ["plugin.json", "mcp.json", ".mcp.json", ".codex-plugin/plugin.json", "package.json"]) {
	try {
		JSON.parse(readFileSync(resolve(root, manifestPath), "utf8"));
	} catch (error) {
		failures.push(`${manifestPath}: ${error.message}`);
	}
}

const packageManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const pluginManifest = JSON.parse(readFileSync(resolve(root, "plugin.json"), "utf8"));
const codexPluginManifest = JSON.parse(
	readFileSync(resolve(root, ".codex-plugin/plugin.json"), "utf8"),
);
if (!/^1\.2\./u.test(packageManifest.version ?? "")) {
	failures.push(`package.json must carry independent Skills 1.2.x version, got ${packageManifest.version}`);
}
if (
	pluginManifest.version !== packageManifest.version ||
	codexPluginManifest.version !== packageManifest.version
) {
	failures.push("plugin manifests must agree on the independent Skills distribution version");
}

const scenarios = readFileSync(
	resolve(root, "evaluations/evaluate-ai-change.scenarios.jsonl"),
	"utf8",
)
	.split(/\r?\n/u)
	.filter(Boolean)
	.map((line) => JSON.parse(line));

if (scenarios.length !== 30) failures.push(`expected 30 scenarios, got ${scenarios.length}`);
if (new Set(scenarios.map((scenario) => scenario.scenarioId)).size !== 30) {
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
	if (typeof scenario.scenarioId !== "string" || scenario.scenarioId.length === 0) {
		failures.push("every scenario must have a non-empty scenarioId");
	}
	if (typeof scenario.prompt !== "string" || scenario.prompt.length === 0) {
		failures.push(`${scenario.scenarioId ?? "unknown"}: prompt must be a non-empty string`);
	}
	if (!scenario.expected || typeof scenario.expected !== "object") {
		failures.push(`${scenario.scenarioId ?? "unknown"}: expected decision object is required`);
		continue;
	}
	for (const actionField of ["requiredActions", "prohibitedActions"]) {
		if (
			!Array.isArray(scenario.expected[actionField]) ||
			scenario.expected[actionField].some(
				(action) => typeof action !== "string" || action.length === 0,
			) ||
			new Set(scenario.expected[actionField]).size !==
				scenario.expected[actionField].length
		) {
			failures.push(`${scenario.scenarioId}: ${actionField} must be unique non-empty strings`);
		}
	}
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
	const semantic = scenario.expected.semanticExpectations ?? {};
	for (const action of [
		...(semantic.requiredActions ?? []),
		...(semantic.prohibitedActions ?? []),
	]) {
		if (typeof action !== "string" || action.length === 0) {
			failures.push(`${scenario.scenarioId}: semantic actions must be non-empty strings`);
		}
	}
	for (const dimension of semantic.requiredNotMeasured ?? []) {
		if (!evidenceDimensions.includes(dimension)) {
			failures.push(`${scenario.scenarioId}: unknown semantic evidence dimension ${dimension}`);
		}
	}
	for (const [dimension, measurementNames] of Object.entries(
		semantic.requiredMeasurements ?? {},
	)) {
		if (!evidenceDimensions.includes(dimension)) {
			failures.push(`${scenario.scenarioId}: unknown semantic evidence dimension ${dimension}`);
		}
		if (
			!Array.isArray(measurementNames) ||
			measurementNames.some(
				(name) => typeof name !== "string" || name.length === 0,
			)
		) {
			failures.push(
				`${scenario.scenarioId}: semantic requiredMeasurements must contain non-empty names`,
			);
		}
	}
}

if (!scenarios.some((scenario) => scenario.scenarioId === "mixed-bug-sweep")) {
	failures.push("scenario coverage omits mixed-bug-sweep");
}
for (const letter of "ABCDEFGHIJKLMNOPQRS") {
	if (!scenarios.some((scenario) => scenario.scenarioId === `adversarial-${letter}-` || scenario.scenarioId.startsWith(`adversarial-${letter}-`))) {
		failures.push(`scenario coverage omits adversarial scenario ${letter}`);
	}
}

const regressionSkill = readFileSync(
	resolve(skillsRoot, "run-regression-gate/SKILL.md"),
	"utf8",
);
for (const requiredGateText of [
	"capabilities --format json",
	"--help",
	"decisionPassed",
	"evidencePassed",
	"releaseReady",
	"provider_unavailable",
	"cache_reused",
	"trajectory",
	"malformed",
	"unknown",
]) {
	if (!regressionSkill.includes(requiredGateText)) {
		failures.push(`run-regression-gate omits ${requiredGateText}`);
	}
}
if (/Stable exit codes|\|\s*0\s*\|/iu.test(regressionSkill)) {
	failures.push("run-regression-gate must not hardcode a stable numeric exit-code table");
}
if (!existsSync(resolve(root, "scripts/evaluate-ai-change-harness.mjs"))) {
	failures.push("behavioral harness is missing");
}
if (!existsSync(resolve(root, "evaluations/3.8-convergence-truth-ledger.md"))) {
	failures.push("3.8 convergence truth ledger is missing");
}
const harness = readFileSync(resolve(root, "scripts/evaluate-ai-change-harness.mjs"), "utf8");
for (const requiredHarnessText of [
	"contract_fixture",
	"executed: false",
	"model_comparison",
	"compare-providers",
	"openai",
	"anthropic",
	"credential-safe",
	"not_run",
	"parsePassed",
	"provider",
	"model",
	"promptHash",
	"outputHash",
	"latencyMsByScenario",
]) {
	if (!harness.includes(requiredHarnessText)) {
		failures.push(`behavioral harness omits ${requiredHarnessText}`);
	}
}

const primarySkill = readFileSync(
	resolve(skillsRoot, "evaluate-ai-change/SKILL.md"),
	"utf8",
);
const setupSkill = readFileSync(
	resolve(skillsRoot, "setup-evalgate-project/SKILL.md"),
	"utf8",
);
for (const requiredSetupText of [
	"capabilities --format json",
	"--package-handler",
	"multiple supported package roots",
	"fail closed",
	"custom runner",
]) {
	if (!setupSkill.includes(requiredSetupText)) {
		failures.push(`setup-evalgate-project omits ${requiredSetupText}`);
	}
}
const authReferencePath = resolve(
	skillsRoot,
	"evaluate-ai-change/references/authentication-and-credential-handoff.md",
);
if (/RFC\s*8628|device(?:-grant|-flow)?/iu.test(setupSkill)) {
	if (!existsSync(authReferencePath)) {
		failures.push("setup-evalgate-project references device handoff without a canonical auth reference");
	} else {
		const authReference = readFileSync(authReferencePath, "utf8");
		for (const currentAuthPath of ["/oauth/device/authorization", "/oauth/token", "auth status"]) {
			if (!authReference.includes(currentAuthPath)) {
				failures.push(`canonical auth reference omits current path ${currentAuthPath}`);
			}
		}
	}
}
if (/3\.7(?:\.|\b)/u.test(readme)) {
	failures.push("README.md contains a stale SDK 3.7 compatibility claim");
}
for (const classification of classifications) {
	if (!primarySkill.includes(`\`${classification}\``)) {
		failures.push(`primary skill omits canonical classification ${classification}`);
	}
}
for (const redTeamText of ["/red-team", "get_red_team_workspace", "signed-report"]) {
	if (!primarySkill.includes(redTeamText)) {
		failures.push(`primary skill omits red-team contract detail ${redTeamText}`);
	}
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`FAIL: ${failure}`);
	process.exit(1);
}

console.log(`PASS: ${skillNames.length} skills and ${scenarios.length} scenarios validated`);
