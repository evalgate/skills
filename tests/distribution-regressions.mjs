import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { exportWebsite, websiteFiles } from "../scripts/export-website.mjs";
import { validateDecisionContract } from "../scripts/evaluate-ai-change-contract.mjs";
import { checkStandalone } from "../scripts/check-standalone.mjs";

const dir = mkdtempSync(resolve(tmpdir(), "evalgate-export-test-"));
try {
  const count = exportWebsite(dir);
  assert.equal(exportWebsite(dir, { check: true }), count);
  const prefix = ".well-known/agent-skills/";
  const index = JSON.parse(readFileSync(resolve(dir, prefix, "index.json")));
  assert.equal(index.skills.length, 6);
  for (const skill of index.skills) {
    const bytes = readFileSync(resolve(dir, skill.url.slice(1)));
    assert.equal(skill.digest, `sha256:${createHash("sha256").update(bytes).digest("hex")}`);
    assert.deepEqual(checkStandalone(resolve(dir, prefix, skill.name)), []);
  }
  const schemaFile = "schemas/evaluate-ai-change-decision.schema.json";
  assert.ok(readFileSync(resolve(dir, schemaFile)).equals(websiteFiles().get(`${prefix}evaluate-ai-change/assets/decision-contract.schema.json`)));
  writeFileSync(resolve(dir, schemaFile), "{}");
  assert.throws(() => exportWebsite(dir, { check: true }), /drift: schemas/);
  exportWebsite(dir);
  writeFileSync(resolve(dir, prefix, "unexpected.md"), "stale copy");
  assert.throws(() => exportWebsite(dir, { check: true }), /stale: .*unexpected.md/);
  rmSync(resolve(dir, prefix, "unexpected.md"));
  writeFileSync(resolve(dir, prefix, "evaluate-ai-change/SKILL.md"), "[missing](../other/SKILL.md)");
  assert.ok(checkStandalone(resolve(dir, prefix, "evaluate-ai-change")).some((error) => error.includes("unavailable standalone")));
} finally { rmSync(dir, { recursive: true, force: true }); }

const decision = {
  invokeEvalGate: true, classification: "not_a_change", releaseDecision: "inform",
  actions: ["inspect_case_evidence"], actionKinds: ["inspect_evidence"],
  evidenceSummary: Object.fromEntries(["quality", "protectedSlices", "reliability", "latency", "cost"].map((name) => [name, { status: "not_measured", reason: "No execution requested." }])),
};
assert.deepEqual(validateDecisionContract(decision), []);
assert.ok(validateDecisionContract({ ...decision, actionKinds: ["made_up"] }).length);
assert.ok(validateDecisionContract({ ...decision, actionKinds: ["inspect_evidence", "inspect_evidence"] }).length);
assert.ok(validateDecisionContract({ ...decision, releaseDecision: "promote" }).length);
console.log("PASS: standalone, website drift, schema extension, and canonical enum regression tests");
