#!/usr/bin/env node

import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

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
	for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/gu)) {
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

if (scenarios.length !== 8) failures.push(`expected 8 scenarios, got ${scenarios.length}`);
if (new Set(scenarios.map((scenario) => scenario.scenarioId)).size !== 8) {
	failures.push("scenario IDs must be unique");
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`FAIL: ${failure}`);
	process.exit(1);
}

console.log(`PASS: ${skillNames.length} skills and ${scenarios.length} scenarios validated`);
