#!/usr/bin/env node
// Runner adapter for EvalGate's own skill tester:
//
//   npx @evalgate/sdk skill test --skill skills/run-regression-gate \
//     --cases <cases.jsonl> --trials 3 --format json \
//     --runner "node scripts/skill-test-runner.mjs --provider anthropic --model <id>"
//
// The SDK passes the prompt on stdin and sets EVALGATE_SKILL_VARIANT and
// EVALGATE_SKILL_DIR. This prints one JSON line: variant, invokedSkills,
// output and exitCode. A provider failure is reported as exitCode 1 (a failed
// task) and the process still exits 0, so one timeout does not abort the
// whole paired run (see PC-010 in evaluations/sdk-papercuts.json).

import { resolve } from "node:path";
import { createChatProvider, readFrontmatter } from "./lib/agent-loop.mjs";
import { runSkillCase } from "./lib/skill-case-runner.mjs";

const argv = process.argv.slice(2);
const option = (name) => {
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : undefined;
};
const variant = process.env.EVALGATE_SKILL_VARIANT;
const directory = process.env.EVALGATE_SKILL_DIR;
if (!["with", "without"].includes(variant) || !directory) {
	console.error("Run this through `evalgate skill test --runner`; EVALGATE_SKILL_VARIANT and EVALGATE_SKILL_DIR are required.");
	process.exit(5);
}
const temperature = option("--temperature") === undefined ? undefined : Number(option("--temperature"));
const { chat, metadata } = createChatProvider({ provider: option("--provider"), model: option("--model"), temperature });
if (!chat) {
	console.error(`Missing credentials for ${metadata.provider}`);
	process.exit(2);
}
let prompt = "";
for await (const chunk of process.stdin) prompt += chunk;
const targetSkill = readFrontmatter(resolve(directory, "SKILL.md")).name;
const observation = await runSkillCase({ chat, targetSkill, variant, prompt });
console.log(
	JSON.stringify({
		variant: observation.variant,
		invokedSkills: observation.invokedSkills,
		output: observation.output,
		exitCode: observation.exitCode,
	}),
);
