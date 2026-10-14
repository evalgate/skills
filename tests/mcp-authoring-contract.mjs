import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const mcp = read("skills/use-evalgate-mcp/SKILL.md");
const guide = read("skills/use-evalgate-mcp/references/scoped-authoring.md");
const agents = read("AGENTS.md");
const primary = read("skills/evaluate-ai-change/SKILL.md");
const portal = read("skills/evaluate-ai-change/references/portable-artifact-workflows.md");
const readme = read("README.md");

for (const tool of [
  "evaluations.create", "test_cases.add", "runs.start", "traces.create"
]) assert.ok(mcp.includes(tool) && guide.includes(tool), `missing supported authoring tool: ${tool}`);
for (const required of [
  "admin:workspace", "eval:write", "runs:write", "traces:write",
  "resources:read", "resources:write", "anonymous", "human", "not"
]) assert.ok(guide.toLowerCase().includes(required.toLowerCase()), `missing write boundary: ${required}`);
for (const text of [mcp, guide, primary, readme, agents, portal]) {
  assert.ok(!text.includes("Product MCP is read-only at the reviewed contract"), "stale blanket read-only description");
  assert.ok(!text.includes("product MCP tools are read-only"), "stale blanket read-only description");
}
assert.ok(mcp.includes("https://www.evalgate.com/api/mcp/docs"), "docs endpoint missing");
assert.ok(mcp.includes("https://www.evalgate.com/api/mcp"), "product endpoint missing");
assert.match(mcp, /explicit (?:user |human )?approval|ask (?:for )?approval|consent/i);
assert.match(mcp, /quality\.check\.submit|Portable Quality/);
assert.ok(read("docs/SMITHERY_HANDOFF.md").includes("No anonymous writes") || read("docs/SMITHERY_HANDOFF.md").includes("No anonymous writes."));
console.log("PASS: MCP write discovery, role/scope boundaries, Smithery handoff and no blanket read-only claim");
