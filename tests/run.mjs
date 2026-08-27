#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

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
}

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

console.log("PASS: distribution and positive/negative skill evaluation fixtures");
