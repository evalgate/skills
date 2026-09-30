#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const digest = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export function websiteFiles(sourceRoot = root) {
  const files = new Map();
  const skills = [];
  const prefix = ".well-known/agent-skills/";
  function walk(dir, path = "") {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error(`Cannot export symlink ${path}${entry.name}`);
      if (entry.isDirectory()) walk(resolve(dir, entry.name), `${path}${entry.name}/`);
      else files.set(prefix + path + entry.name, readFileSync(resolve(dir, entry.name)));
    }
  }
  walk(resolve(sourceRoot, "skills"));
  for (const entry of readdirSync(resolve(sourceRoot, "skills"), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const name = entry.name, file = `${prefix}${name}/SKILL.md`, bytes = files.get(file);
    const description = bytes.toString().match(/^description: (.+)$/mu)?.[1];
    if (!description) throw new Error(`Missing description for ${name}`);
    skills.push({ name, type: "skill-md", description, url: `/${file}`, digest: digest(bytes) });
  }
  files.set("schemas/evaluate-ai-change-decision.schema.json", files.get(`${prefix}evaluate-ai-change/assets/decision-contract.schema.json`));
  files.set(prefix + "index.json", Buffer.from(JSON.stringify({ $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json", skills }, null, "\t") + "\n"));
  const distributionVersion = JSON.parse(readFileSync(resolve(sourceRoot, "package.json"), "utf8")).version;
  const inventory = Object.fromEntries([...files].sort(([a],[b]) => a.localeCompare(b)).map(([file, bytes]) => [file, digest(bytes)]));
  files.set(prefix + "manifest.json", Buffer.from(JSON.stringify({ distributionVersion, files: inventory }, null, "\t") + "\n"));
  return files;
}
export function exportWebsite(output, { check = false } = {}) {
  const files = websiteFiles();
  const failures = [];
  for (const [file, bytes] of files) {
    const target = resolve(output, file);
    if (check) {
      if (!existsSync(target) || !bytes.equals(readFileSync(target))) failures.push(`drift: ${file}`);
    } else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes); }
  }
  const exportedRoot = resolve(output, ".well-known/agent-skills");
  function checkExtra(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = prefix + entry.name;
      if (entry.isDirectory()) checkExtra(resolve(dir, entry.name), file + "/");
      else if (!files.has(file)) failures.push(`stale: ${file}`);
    }
  }
  if (check && existsSync(exportedRoot)) checkExtra(exportedRoot, ".well-known/agent-skills/");
  if (failures.length) throw new Error(failures.join("\n"));
  return files.size;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const index = process.argv.indexOf("--output");
    if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith("--")) throw new Error("Usage: export-website.mjs --output <website-public-directory> [--check]");
    const count = exportWebsite(resolve(process.argv[index + 1]), { check: process.argv.includes("--check") });
    console.log(`PASS: ${count} canonical website files ${process.argv.includes("--check") ? "verified" : "exported"}`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
