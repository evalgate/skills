#!/usr/bin/env node
// Measures how much context the EvalGate product MCP adds before a user types
// anything. A client that installs an MCP server loads every tool definition
// into every call; Uber measured 50,000 to 70,000 tokens for 100+ tools. Run
// this when the tool catalog changes, anonymously and, with EVALGATE_API_KEY,
// as an authenticated caller (whose role-filtered list is what agents see).
//
//   node scripts/measure-mcp-context.mjs [--url <mcp url>] [--max-tokens 10000]

const argv = process.argv.slice(2);
const option = (name, fallback) => {
	const index = argv.indexOf(name);
	return index >= 0 ? argv[index + 1] : fallback;
};
const url = option("--url", "https://www.evalgate.com/api/mcp");
const maxTokens = Number(option("--max-tokens", "10000"));

async function rpc(method, params, headers) {
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	const text = await response.text();
	const json = text.trim().startsWith("{") ? text : text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5)).pop();
	return { status: response.status, body: json ? JSON.parse(json) : undefined };
}

async function measure(label, headers) {
	const { status, body } = await rpc("tools/list", {}, headers);
	const tools = body?.result?.tools ?? [];
	const bytes = Buffer.byteLength(JSON.stringify(tools));
	// About four characters per token for JSON schemas.
	return { caller: label, status, tools: tools.length, bytes, estimatedTokens: Math.round(bytes / 4), names: tools.map((tool) => tool.name) };
}

const results = [await measure("anonymous", {})];
if (process.env.EVALGATE_API_KEY) {
	results.push(await measure("authenticated", { authorization: `Bearer ${process.env.EVALGATE_API_KEY}` }));
}
const worst = Math.max(...results.map((result) => result.estimatedTokens));
console.log(JSON.stringify({ schemaVersion: 1, url, maxTokens, results, withinBudget: worst <= maxTokens }));
process.exitCode = worst <= maxTokens ? 0 : 1;
