#!/usr/bin/env node
// Skill linter: pass/fail checks distilled from what made skills work or fail
// (Uber's "skill code smell" linter is the model) plus this repository's own
// spec and papercut ledger. Run with --report to print the token budget table.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkillDirectories, readFrontmatter } from "./lib/agent-loop.mjs";

const root = resolve(import.meta.dirname, "..");

/**
 * Phrases that describe a retry loop with no bound. They are refused anywhere
 * in a skill body, even next to "never" or "do not": an agent skimming the
 * line can take the phrase as the instruction.
 */
export const UNBOUNDED_RETRY_PHRASES = Object.freeze([
	/\buntil (?:it'?s |the \w+ (?:is|are) )?green\b/iu,
	/\buntil (?:it|they|the \w+) pass(?:es)?\b/iu,
	/\bkeep (?:re-?trying|trying|re-?running)\b/iu,
	/\bretry (?:it |them |the \w+ )?until\b/iu,
	/\bretry (?:forever|indefinitely|repeatedly)\b/iu,
]);

// A retry is bounded when the line forbids it, caps it, or names a fix instead.
const RETRY_BOUND = /\b(never|not|don't|doesn't|without|at most|once|instead|marks)\b/iu;

/** Why a line teaches an unbounded retry, or undefined when it does not. */
export function unboundedRetryProblem(line) {
	const phrase = UNBOUNDED_RETRY_PHRASES.find((pattern) => pattern.test(line));
	if (phrase) return `uses the unbounded retry phrase "${line.match(phrase)[0]}"`;
	if (/\b(try again|retry)\b/iu.test(line) && !RETRY_BOUND.test(line)) return "retries without a bound or a fix";
	return undefined;
}

// Imported for its rules (tests) the module does not scan the repository.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

function main() {
const failures = [];
const rows = [];
const fail = (message) => failures.push(message);

function listFiles(directory) {
	const files = [];
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const path = resolve(current, entry.name);
			if (entry.isDirectory()) walk(path);
			else files.push(path);
		}
	};
	walk(directory);
	return files;
}

// Rough token estimate (about 1.3 tokens per English word). Good enough to
// compare skills and catch growth; not a billing number.
const tokens = (text) => Math.round(text.split(/\s+/u).filter(Boolean).length * 1.3);

const directories = discoverSkillDirectories(root);
const names = new Set();
for (const directory of directories) {
	const skillFile = resolve(directory, "SKILL.md");
	const { name, description, text } = readFrontmatter(skillFile);
	names.add(name);
	const label = relative(root, directory);
	const specPath = resolve(root, "specs", `${name}.spec.json`);
	if (!existsSync(specPath)) {
		fail(`${label}: missing specs/${name}.spec.json`);
		continue;
	}
	const spec = JSON.parse(readFileSync(specPath, "utf8"));
	const body = text.slice(text.indexOf("\n---", 4) + 4);
	const lines = text.split(/\r?\n/u).length;
	const words = body.split(/\s+/u).filter(Boolean).length;
	const files = listFiles(directory);
	const referenceText = files
		.filter((file) => file.endsWith(".md") && file !== skillFile)
		.map((file) => readFileSync(file, "utf8"))
		.join("\n");

	// Budget: always-loaded description, and the body loaded on every run.
	if (spec.skill !== name) fail(`${label}: spec names ${spec.skill}`);
	if (lines > spec.budget.maxLines) fail(`${label}: ${lines} lines; budget ${spec.budget.maxLines}`);
	if (description.length > spec.budget.maxDescriptionChars) fail(`${label}: description is ${description.length} characters; budget ${spec.budget.maxDescriptionChars}`);
	if (words > spec.budget.maxWords) fail(`${label}: body is ${words} words; budget ${spec.budget.maxWords}. Move detail into a reference.`);

	// Steps are numbered so each has one objective an agent can check off.
	if ((body.match(/^\d+\.\s/gmu) ?? []).length < 3) fail(`${label}: needs a numbered workflow of at least three steps`);

	// Error recovery: a table of failures and fixes, never "try again".
	if (spec.usesCli) {
		if (!body.includes("## Recovery")) fail(`${label}: CLI skill has no ## Recovery section`);
		if (!body.includes("references/failure-recovery.md")) fail(`${label}: Recovery does not link references/failure-recovery.md`);
		if (!existsSync(resolve(directory, "references/failure-recovery.md"))) fail(`${label}: references/failure-recovery.md is not bundled`);
	}
	for (const line of body.split(/\r?\n/u)) {
		const problem = unboundedRetryProblem(line);
		if (problem) fail(`${label}: recovery advice "${line.trim().slice(0, 80)}" ${problem}`);
	}

	// Progressive disclosure: every bundled reference must be reachable from SKILL.md.
	for (const file of files) {
		const relativePath = relative(directory, file).split("\\").join("/");
		if (file === skillFile) continue;
		const fileName = relativePath.split("/").pop();
		if (!body.includes(relativePath) && !body.includes(fileName) && !referenceText.includes(fileName)) {
			fail(`${label}: ${relativePath} is bundled but nothing links to it`);
		}
		if (/(^|\/)\.?mcp\.json$/u.test(relativePath)) fail(`${label}: skills must not install MCP servers (${relativePath})`);
	}

	// Spec: commands the skill promises, patterns it must never teach.
	for (const command of spec.requiredCommands) {
		if (!body.includes(command) && !referenceText.includes(command)) fail(`${label}: spec requires command "${command}"`);
	}
	for (const pattern of spec.forbiddenPatterns) {
		if (new RegExp(pattern, "u").test(body)) fail(`${label}: matches forbidden pattern /${pattern}/`);
	}
	if (!existsSync(resolve(root, spec.cases))) fail(`${label}: spec cases file ${spec.cases} is missing`);

	rows.push({ skill: name, audience: spec.audience, descriptionChars: description.length, descriptionTokens: tokens(description), bodyLines: lines, bodyWords: words, bodyTokens: tokens(body), referenceFiles: files.length - 1 });
}

for (const file of readdirSync(resolve(root, "specs")).filter((file) => file.endsWith(".spec.json"))) {
	if (!names.has(file.replace(".spec.json", ""))) fail(`specs/${file}: no skill with that name`);
}

// Papercut ledger: open workarounds must still be present (ledger stays true);
// fixed ones must be gone (the workaround is deleted once the SDK fix ships).
const ledger = JSON.parse(readFileSync(resolve(root, "evaluations/sdk-papercuts.json"), "utf8"));
const ids = new Set();
for (const entry of ledger.papercuts) {
	if (ids.has(entry.id)) fail(`papercut ${entry.id}: duplicate id`);
	ids.add(entry.id);
	if (!["open", "fixed"].includes(entry.status)) fail(`papercut ${entry.id}: status must be open or fixed`);
	for (const { file, phrase } of entry.workaround) {
		const path = resolve(root, file);
		const present = existsSync(path) && readFileSync(path, "utf8").includes(phrase);
		if (entry.status === "open" && !present) fail(`papercut ${entry.id}: "${phrase}" is no longer in ${file}; mark it fixed or update the ledger`);
		if (entry.status === "fixed" && present) fail(`papercut ${entry.id} is fixed but ${file} still carries the workaround "${phrase}"`);
	}
}

if (process.argv.includes("--report")) {
	console.log("| Skill | Audience | Description tokens | Body lines | Body tokens | Reference files |");
	console.log("| --- | --- | ---: | ---: | ---: | ---: |");
	for (const row of rows.sort((a, b) => a.skill.localeCompare(b.skill))) {
		console.log(`| ${row.skill} | ${row.audience} | ${row.descriptionTokens} | ${row.bodyLines} | ${row.bodyTokens} | ${row.referenceFiles} |`);
	}
	const always = rows.filter((row) => row.audience === "engineering").reduce((sum, row) => sum + row.descriptionTokens, 0);
	console.log(`\nAlways-loaded description tokens for a default engineering install: ${always}`);
}
if (failures.length) {
	for (const failure of failures) console.error(`FAIL: ${failure}`);
	process.exitCode = 1;
} else {
	console.log(`PASS: ${rows.length} skills meet spec, budget, workflow, recovery and papercut-ledger rules`);
}
}
