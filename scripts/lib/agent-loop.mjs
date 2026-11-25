// Shared, provider-neutral agent loop for behavioral skill evaluation.
//
// Two loading modes:
//   bundle       every file concatenated into one system prompt (legacy;
//                useful as a ceiling, but no real agent sees this context)
//   progressive  the agent sees only each skill's name and description, then
//                asks to load a SKILL.md and to read individual references,
//                exactly as an Agent Skills client does
//
// The protocol is plain JSON in text, so it works with any chat model and
// needs no provider tool-calling feature. Every load and read is recorded so
// the caller can score the loading trajectory, not only the final answer.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

export const MAX_LOADING_TURNS = 8;

export function readFrontmatter(skillFile) {
	const text = readFileSync(skillFile, "utf8");
	const match = text.match(/^---\r?\nname: ([^\r\n]+)\r?\ndescription: ([^\r\n]+)\r?\n---/u);
	if (!match) throw new Error(`${skillFile}: missing name/description frontmatter`);
	return { name: match[1].trim(), description: match[2].trim(), text };
}

/** Skill directories that a client would discover for this distribution. */
export function discoverSkillDirectories(root, groups = ["skills", "everyday"]) {
	const directories = [];
	for (const group of groups) {
		const base = resolve(root, group);
		if (!existsSync(base)) continue;
		for (const entry of readdirSync(base, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const directory = resolve(base, entry.name);
			if (existsSync(resolve(directory, "SKILL.md"))) directories.push(directory);
		}
	}
	return directories;
}

export function buildCatalog(directories, { exclude = [] } = {}) {
	return directories
		.map((directory) => ({ directory, ...readFrontmatter(resolve(directory, "SKILL.md")) }))
		.filter((skill) => !exclude.includes(skill.name))
		.sort((left, right) => left.name.localeCompare(right.name));
}

export function listSkillFiles(directory) {
	const files = [];
	const walk = (current) => {
		for (const entry of readdirSync(current, { withFileTypes: true })) {
			const path = resolve(current, entry.name);
			if (entry.isDirectory()) walk(path);
			else if (entry.isFile() && entry.name !== "SKILL.md") {
				files.push(relative(directory, path).split(sep).join("/"));
			}
		}
	};
	walk(directory);
	return files.sort();
}

export function progressiveSystemPrompt(catalog, outputContract) {
	const entries = catalog
		.map((skill) => `- ${skill.name}: ${skill.description}`)
		.join("\n");
	return [
		"You are a coding or work assistant with an Agent Skills catalog.",
		"Only each skill's name and description are loaded now. Load a skill only when its description matches the request.",
		"Available skills:",
		entries.length > 0 ? entries : "(none)",
		"",
		"Reply with exactly one JSON object per turn and nothing else:",
		'- {"load": "<skill-name>"} returns that skill\'s SKILL.md and its file list.',
		'- {"read": "<skill-name>/<relative path>"} returns one file a loaded skill references.',
		'- {"final": <answer>} ends the task.',
		`You may take at most ${MAX_LOADING_TURNS} load/read turns before answering.`,
		"",
		outputContract,
	].join("\n");
}

export function bundleSystemPrompt(sections, outputContract) {
	return [...sections, outputContract].join("\n\n");
}

function stripFence(content) {
	return content
		.trim()
		.replace(/^```(?:json)?\s*/iu, "")
		.replace(/\s*```$/u, "");
}

/** Parse one JSON object from a model turn; tolerate prose around it. */
export function parseTurn(content) {
	if (typeof content !== "string" || content.trim().length === 0) {
		return { error: "empty_response" };
	}
	const text = stripFence(content);
	try {
		return { value: JSON.parse(text) };
	} catch {
		const start = text.indexOf("{");
		const end = text.lastIndexOf("}");
		if (start >= 0 && end > start) {
			try {
				return { value: JSON.parse(text.slice(start, end + 1)) };
			} catch {
				/* fall through */
			}
		}
		return { error: "invalid_json" };
	}
}

function emptyUsage() {
	return { inputTokens: 0, outputTokens: 0, calls: 0 };
}

/** Count one completed provider call and add the tokens it reported, if any. */
export function addUsage(total, usage) {
	total.calls += 1;
	if (!usage) return total;
	total.inputTokens += Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
	total.outputTokens += Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
	return total;
}

/**
 * A provider failure (HTTP status, network error, timeout) says nothing about
 * the skill. Callers exclude these from skill pass/fail and report them apart.
 */
export function isAdapterError(error) {
	return Boolean(error && (typeof error.status === "number" || error.adapterError === true || error.name === "TypeError" || error.name === "AbortError"));
}

/**
 * Built-in chat provider. Returns undefined when credentials are absent so the
 * caller can report a skip instead of fabricating execution.
 */
export function createChatProvider({ provider, model, temperature }) {
	const normalized = provider?.toLowerCase();
	if (!["openai", "anthropic"].includes(normalized)) {
		throw new Error(`Built-in provider must be openai or anthropic, got ${provider}`);
	}
	if (!model) throw new Error("A model is required for a built-in provider");
	const apiKey = process.env[normalized === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"];
	const metadata = { provider: normalized, model, adapter: "builtin", credentialsAvailable: Boolean(apiKey) };
	if (!apiKey) return { metadata, chat: undefined };
	const baseUrl = (
		process.env[normalized === "openai" ? "OPENAI_BASE_URL" : "ANTHROPIC_BASE_URL"] ??
		(normalized === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com")
	).replace(/\/$/u, "");
	const chat = async ({ system, messages }) => {
		const response =
			normalized === "openai"
				? await fetch(`${baseUrl}/chat/completions`, {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
						body: JSON.stringify({
							model,
							...(temperature === undefined ? {} : { temperature }),
							messages: [{ role: "system", content: system }, ...messages],
						}),
					})
				: await fetch(`${baseUrl}/v1/messages`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"x-api-key": apiKey,
							"anthropic-version": "2023-06-01",
						},
						body: JSON.stringify({
							model,
							max_tokens: 4096,
							...(temperature === undefined ? {} : { temperature }),
							system,
							messages,
						}),
					});
		if (!response.ok) {
			const error = new Error(`${normalized} request failed with HTTP ${response.status}`);
			error.status = response.status;
			throw error;
		}
		const payload = await response.json();
		const content =
			normalized === "openai"
				? payload.choices?.[0]?.message?.content
				: payload.content?.find((part) => part?.type === "text")?.text;
		return { content, usage: payload.usage };
	};
	return { metadata, chat };
}

/**
 * Run one task. In progressive mode the agent can load skills from `catalog`
 * and read files inside skills it has loaded. Returns the final answer, the
 * ordered loading trajectory, and summed token usage.
 */
export async function runAgentTask({ chat, system, userContent, catalog = [], progressive }) {
	const messages = [{ role: "user", content: userContent }];
	const trajectory = [];
	const invokedSkills = [];
	const usage = emptyUsage();
	const loaded = new Map();
	const byName = new Map(catalog.map((skill) => [skill.name, skill]));
	for (let turn = 0; turn <= MAX_LOADING_TURNS; turn++) {
		let reply;
		try {
			reply = await chat({ system, messages });
		} catch (error) {
			// Keep the tokens already spent on earlier turns of this task.
			return {
				final: undefined,
				error: "adapter_error",
				adapterError: true,
				httpStatus: typeof error?.status === "number" ? error.status : undefined,
				detail: error instanceof Error ? error.message : String(error),
				trajectory,
				invokedSkills,
				usage,
			};
		}
		addUsage(usage, reply.usage);
		const parsed = parseTurn(reply.content);
		messages.push({ role: "assistant", content: reply.content ?? "" });
		if (parsed.error) {
			return { final: undefined, error: parsed.error, trajectory, invokedSkills, usage };
		}
		const value = parsed.value;
		if (!progressive) {
			return { final: value?.final ?? value, trajectory, invokedSkills, usage };
		}
		if (value && Object.hasOwn(value, "final")) {
			return { final: value.final, trajectory, invokedSkills, usage };
		}
		let observation;
		if (typeof value?.load === "string") {
			const skill = byName.get(value.load);
			trajectory.push({ type: "load", target: value.load, ok: Boolean(skill) });
			if (skill) {
				loaded.set(skill.name, skill);
				if (!invokedSkills.includes(skill.name)) invokedSkills.push(skill.name);
				observation = `SKILL ${skill.name}\nFiles: ${listSkillFiles(skill.directory).join(", ") || "(none)"}\n\n${skill.text}`;
			} else {
				observation = `No skill named ${value.load} is installed.`;
			}
		} else if (typeof value?.read === "string") {
			const [skillName, ...rest] = value.read.split("/");
			const skill = loaded.get(skillName);
			const relativePath = rest.join("/");
			const target = skill ? resolve(skill.directory, relativePath) : undefined;
			const inside =
				target && (target === skill.directory || target.startsWith(`${skill.directory}${sep}`));
			const ok = Boolean(inside && existsSync(target) && statSync(target).isFile());
			trajectory.push({ type: "read", target: value.read, ok });
			observation = ok
				? `FILE ${value.read}\n\n${readFileSync(target, "utf8")}`
				: `Cannot read ${value.read}: load the skill first and use a path from its file list.`;
		} else {
			trajectory.push({ type: "invalid", target: null, ok: false });
			observation = 'Reply with {"load": ...}, {"read": ...} or {"final": ...}.';
		}
		messages.push({ role: "user", content: observation });
	}
	return { final: undefined, error: "loading_turn_limit", trajectory, invokedSkills, usage };
}

/** Wilson score interval for a binomial proportion. */
export function wilsonInterval(successes, total, z = 1.96) {
	if (total === 0) return { lower: null, upper: null };
	const p = successes / total;
	const denominator = 1 + (z * z) / total;
	const centre = p + (z * z) / (2 * total);
	const margin = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
	return {
		lower: Number(((centre - margin) / denominator).toFixed(4)),
		upper: Number(((centre + margin) / denominator).toFixed(4)),
	};
}

/**
 * Noise band: how often repeated trials of the same arm disagree on one case.
 * 0 means every trial agreed; 0.5 means a coin flip. Descriptive only: lift is
 * decided by pairedSignTest over scenarios, not by comparing against this band.
 * Outcomes of null (a provider failure) are ignored.
 */
export function noiseBand(outcomesByCase) {
	const cases = [...outcomesByCase.values()]
		.map((outcomes) => outcomes.filter((outcome) => outcome !== null))
		.filter((outcomes) => outcomes.length > 1);
	if (cases.length === 0) return null;
	const disagreement = cases.map((outcomes) => {
		const passes = outcomes.filter(Boolean).length;
		return Math.min(passes, outcomes.length - passes) / outcomes.length;
	});
	return Number((disagreement.reduce((sum, value) => sum + value, 0) / cases.length).toFixed(4));
}

/** log(n choose k) via a running sum; exact enough for n up to a few thousand. */
function logChoose(n, k) {
	let value = 0;
	for (let index = 1; index <= k; index++) value += Math.log(n - k + index) - Math.log(index);
	return value;
}

export const DEFAULT_MIN_DECIDED_PAIRS = 6;
export const DEFAULT_ALPHA = 0.05;

/**
 * Exact two-sided sign test on paired scenario outcomes. Each scenario is one
 * pair (with vs without); ties carry no information and are dropped. Lift is
 * significant only when enough scenarios are decided and the split of wins and
 * losses would be unlikely under no effect.
 */
export function pairedSignTest(wins, losses, { alpha = DEFAULT_ALPHA, minDecidedPairs = DEFAULT_MIN_DECIDED_PAIRS } = {}) {
	const decided = wins + losses;
	if (decided === 0) {
		return { test: "exact_sign_test", decidedPairs: 0, pValue: null, alpha, minDecidedPairs, significant: false, direction: null };
	}
	const smaller = Math.min(wins, losses);
	let tail = 0;
	for (let k = 0; k <= smaller; k++) tail += Math.exp(logChoose(decided, k) - decided * Math.LN2);
	const pValue = Number(Math.min(1, 2 * tail).toFixed(6));
	const significant = decided >= minDecidedPairs && pValue < alpha && wins !== losses;
	return {
		test: "exact_sign_test",
		decidedPairs: decided,
		pValue,
		alpha,
		minDecidedPairs,
		significant,
		direction: wins > losses ? "with_better" : wins < losses ? "without_better" : "none",
	};
}

/**
 * Scenario-clustered interval for a pass rate. Trials of one scenario are not
 * independent, so the unit is the scenario: the mean of per-scenario pass
 * rates with a normal interval over scenarios (clamped to [0, 1]).
 */
export function scenarioClusteredInterval(perScenarioRates, z = 1.96) {
	const rates = perScenarioRates.filter((rate) => typeof rate === "number" && Number.isFinite(rate));
	const n = rates.length;
	if (n === 0) return { method: "scenario_clustered_normal", scenarios: 0, mean: null, lower: null, upper: null };
	const mean = rates.reduce((sum, rate) => sum + rate, 0) / n;
	const variance = n > 1 ? rates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / (n - 1) : 0;
	const margin = n > 1 ? z * Math.sqrt(variance / n) : 1;
	const round = (value) => Number(Math.min(1, Math.max(0, value)).toFixed(4));
	return { method: "scenario_clustered_normal", scenarios: n, mean: round(mean), lower: round(mean - margin), upper: round(mean + margin) };
}
