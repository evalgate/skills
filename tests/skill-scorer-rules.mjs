#!/usr/bin/env node
// Unit tests for the trajectory scorer's command matching and provenance,
// and for the linter's unbounded-retry rule.

import assert from "node:assert/strict";
import { unboundedRetryProblem } from "../scripts/lint-skills.mjs";
import {
	commandMatches,
	commandTokens,
	scoreObservation,
	scoreTrajectories,
	TRAJECTORY_FIELDS,
	TRAJECTORY_PROVENANCE,
} from "../scripts/score-skill-trajectory.mjs";

// Command matching is by whole words in order, not substrings.
assert.deepEqual(commandTokens(`npx @evalgate/sdk repo ask "what is 'here'" --format=json`), [
	"npx", "@evalgate/sdk", "repo", "ask", "what is 'here'", "--format", "json",
]);
assert.equal(commandMatches("npx @evalgate/sdk repo scan --json", "repo scan"), true);
assert.equal(commandMatches("npx @evalgate/sdk repo scanner", "repo scan"), false);
assert.equal(commandMatches("npx @evalgate/sdk reinit", "init"), false);
assert.equal(commandMatches("npx @evalgate/sdk init --local", "init"), true);
assert.equal(commandMatches("npx @evalgate/sdk status --json", "status --json"), true);
assert.equal(commandMatches("npx @evalgate/sdk status --jsonl", "status --json"), false);
assert.equal(commandMatches("cat status --json.txt", "status --json"), false);
assert.equal(commandMatches("npx @evalgate/sdk explain --format=json", "explain --format json"), true);
assert.equal(commandMatches("npx @evalgate/sdk repo --verbose scan", "repo scan"), false);
assert.equal(commandMatches("anything", ""), false);

// Every field has a provenance, and only reads are observed.
assert.deepEqual(Object.keys(TRAJECTORY_PROVENANCE).sort(), [...TRAJECTORY_FIELDS].sort());
assert.equal(TRAJECTORY_PROVENANCE.requiredReads, "observed");
assert.equal(TRAJECTORY_PROVENANCE.commandsInOrder, "self_reported");

const testCase = {
	id: "case-1",
	trajectory: { commandsInOrder: ["status --json", "init --local"], forbiddenCommands: ["init --local --apply"], requiredReads: ["references/a.md"] },
};
const observation = (commands, reads = []) => ({
	caseId: "case-1",
	trial: 1,
	variant: "with",
	exitCode: 0,
	output: JSON.stringify({ commands, actions: [] }),
	trajectory: reads.map((target) => ({ type: "read", ok: true, target })),
});
assert.deepEqual(scoreObservation(testCase, observation(["npx @evalgate/sdk status --json", "npx @evalgate/sdk init --local"], ["s/references/a.md"]), "s"), []);

// A substring hit no longer satisfies the order: "init --localhost" is not "init --local".
const substring = scoreObservation(testCase, observation(["npx @evalgate/sdk status --json", "npx @evalgate/sdk init --localhost"], ["s/references/a.md"]), "s");
assert.deepEqual(substring, [{ reason: "command_order", expected: "init --local", source: "self_reported" }]);

const failures = scoreObservation(testCase, observation(["npx @evalgate/sdk status --json", "npx @evalgate/sdk init --local --apply"]), "s");
assert.deepEqual(failures, [
	{ reason: "forbidden_command", command: "init --local --apply", source: "self_reported" },
	{ reason: "missing_read", path: "references/a.md", source: "observed" },
]);
const scored = scoreTrajectories([testCase], [observation([])], "s");
assert.equal(scored.provenance, TRAJECTORY_PROVENANCE);
assert.ok(scored.failures.every((failure) => failure.source));

// Linter: unbounded retry phrases fail even when the line also says "never" or "once".
for (const line of [
	"Retry until green.",
	"Never stop: retry until green.",
	"Run it once, then keep retrying until it passes.",
	"Retry the gate until it passes.",
	"No need to ask, retry the command.",
	"Keep trying with a new seed.",
	"Retry indefinitely on 429.",
	"Re-run until the gate is green.",
	"Try again.",
]) {
	assert.ok(unboundedRetryProblem(line), `expected the linter to refuse: ${line}`);
}
for (const line of [
	"Do not retry a failure the envelope marks `retryable: false`.",
	"Retry at most once after fixing the configuration.",
	"Don't retry it; report the envelope instead.",
	"Read the `retryable` field.",
]) {
	assert.equal(unboundedRetryProblem(line), undefined, `expected the linter to allow: ${line}`);
}

console.log("PASS: trajectory command matching, provenance labels, and unbounded-retry lint rule");
