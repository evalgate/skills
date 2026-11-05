import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
assert.equal(manifest.name, "com.evalgate/evalgate");
assert.equal(manifest.remotes[0].url, "https://www.evalgate.com/api/mcp");
assert.equal(manifest.remotes[0].headers, undefined, "OAuth discovery must not require a pasted bearer key");
const workflow = readFileSync(new URL("../.github/workflows/publish-mcp-registry.yml", import.meta.url), "utf8");
assert.doesNotMatch(workflow, /mcp-publisher\s+(?:publish|login)|id-token:\s*write|^  publish:/m);
assert.match(workflow, /mcp-publisher validate server.json/);
console.log("Canonical MCP metadata and validation-only publication ownership pass");
