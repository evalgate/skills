#!/usr/bin/env node
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const skillsRoot = resolve(root, "skills");
const copies = [
  ["references/provider-and-cache.md", "run-regression-gate/references/provider-and-cache.md"],
  ["references/authentication-and-credential-handoff.md", "setup-evalgate-project/references/authentication-and-credential-handoff.md"],
  ["references/decision-contract.md", "use-evalgate-mcp/references/decision-contract.md"],
  ["assets/decision-contract.schema.json", "use-evalgate-mcp/assets/decision-contract.schema.json"],
];
const failures = [];
for (const [source, target] of copies) {
  const canonical = resolve(skillsRoot, "evaluate-ai-change", source);
  const dest = resolve(skillsRoot, target);
  if (process.argv.includes("--sync")) cpSync(canonical, dest, { recursive: true });
  if (!existsSync(dest) || !readFileSync(canonical).equals(readFileSync(dest))) {
    failures.push(`${target} differs from canonical ${source}; run check-standalone.mjs --sync`);
  }
}
export function checkStandalone(directory) {
  const errors = [];
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) { errors.push(`symlink: ${file}`); continue; }
      if (entry.isDirectory()) { walk(file); continue; }
      if (!file.endsWith(".md")) continue;
      const content = readFileSync(file, "utf8");
      for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
        const link = match[1];
        if (/^(?:https?:|#)/u.test(link)) continue;
        const target = resolve(dirname(file), link.split("#")[0]);
        const rel = relative(directory, target);
        if (rel === ".." || rel.startsWith(`..${sep}`) || !existsSync(target)) {
          errors.push(`${relative(directory, file)}: unavailable standalone reference ${link}`);
        }
      }
    }
  }
  walk(directory);
  return errors;
}
// Copy one directory at a time, exactly as a selective installer does.
for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const temp = mkdtempSync(resolve(tmpdir(), "evalgate-single-skill-"));
  try {
    const installed = resolve(temp, entry.name);
    cpSync(resolve(skillsRoot, entry.name), installed, { recursive: true });
    failures.push(...checkStandalone(installed).map((error) => `${entry.name}: ${error}`));
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
else console.log("PASS: all six skills resolve references when installed independently");
