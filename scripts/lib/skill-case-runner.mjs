// Runs one skill behavior case for one variant (with or without the skill).
// Shared by scripts/skill-tests.mjs (observation collection) and
// scripts/skill-test-runner.mjs (the `evalgate skill test --runner` adapter).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	buildCatalog,
	discoverSkillDirectories,
	progressiveSystemPrompt,
	runAgentTask,
} from "./agent-loop.mjs";

const root = resolve(import.meta.dirname, "../..");

export function actionVocabulary() {
	return JSON.parse(
		readFileSync(resolve(root, "evaluations/skills/action-vocabulary.json"), "utf8"),
	).actions;
}

export function skillOutputContract(vocabulary = actionVocabulary()) {
	return [
		'When you answer, reply {"final": {"route": "<name of the skill you followed, or none>", "actions": ["<action id>", ...], "commands": ["<exact command you would run>", ...], "stop": "<why you stopped, or null>", "reply": "<what you would tell the person, two sentences at most>"}}.',
		"List commands in the order you would run them. List only actions you would actually take; leave out anything you decided against.",
		`Action ids: ${vocabulary.join(", ")}.`,
		"You cannot run commands here. Decide from the request and the facts it states.",
	].join("\n");
}

/**
 * Run one case. Returns a superset of the SDK observation shape: the SDK
 * fields (variant, invokedSkills, output, exitCode) plus the loading
 * trajectory, token usage and latency for this repository's own scoring.
 * A provider failure becomes exitCode 1 (a failed task), never a thrown error,
 * so one timeout does not discard every paired result.
 */
export async function runSkillCase({ chat, targetSkill, variant, prompt, groups }) {
	const catalog = buildCatalog(discoverSkillDirectories(root, groups), {
		exclude: variant === "without" ? [targetSkill] : [],
	});
	const system = progressiveSystemPrompt(catalog, skillOutputContract());
	const startedAt = Date.now();
	try {
		const run = await runAgentTask({ chat, system, userContent: prompt, catalog, progressive: true });
		const output = run.final && typeof run.final === "object" ? JSON.stringify(run.final) : "";
		return {
			variant,
			invokedSkills: run.invokedSkills,
			output,
			exitCode: run.error || !output ? 1 : 0,
			trajectory: run.trajectory,
			usage: run.usage,
			latencyMs: Date.now() - startedAt,
			...(run.error ? { error: run.error } : {}),
			// A provider failure (HTTP, network, timeout) is not a skill failure.
			...(run.adapterError ? { adapterError: true, httpStatus: run.httpStatus } : {}),
		};
	} catch (error) {
		return {
			variant,
			invokedSkills: [],
			output: "",
			exitCode: 1,
			trajectory: [],
			usage: { inputTokens: 0, outputTokens: 0, calls: 0 },
			latencyMs: Date.now() - startedAt,
			error: error instanceof Error ? error.message : String(error),
			adapterError: true,
		};
	}
}
