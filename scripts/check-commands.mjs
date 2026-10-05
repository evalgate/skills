#!/usr/bin/env node
// Fails CI when a skill names an EvalGate CLI command the latest SDK doesn't ship,
// or when the truth ledger records an SDK version older than npm latest.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sdk = process.env.EVALGATE_SDK ?? "@evalgate/sdk@latest";
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";
// Resolve the package once. Re-running npx for every help query repeatedly
// performs registry/install work and can mix versions during a release.
const resolveCli = [
 'const fs = require("node:fs"), path = require("node:path");',
 'for (const dir of process.env.PATH.split(path.delimiter)) {',
 ' const file = path.join(dir, process.platform === "win32" ? "evalgate.cmd" : "evalgate");',
 ' if (!fs.existsSync(file)) continue;',
 ' const bin = path.dirname(fs.realpathSync(file));',
 ' for (const root of [path.resolve(bin, "../@evalgate/sdk"), path.resolve(bin, "../..")]) {',
 '  const manifest = path.join(root, "package.json");',
 '  if (fs.existsSync(manifest) && JSON.parse(fs.readFileSync(manifest)).name === "@evalgate/sdk") { console.log(path.join(root, "dist/cli/index.js")); process.exit(0); }',
 ' }',
 '}',
 'throw new Error("Could not resolve installed @evalgate/sdk CLI");',
].join("\n");
// Windows requires a shell to launch npx.cmd. Passing multi-line source as the
// next argument lets cmd.exe split it at spaces before Node receives `-e`.
// Encode the resolver so the shell sees one inert argument.
const resolveCliArgument = process.platform === "win32"
 ? `eval(Buffer.from('${Buffer.from(resolveCli).toString("base64")}','base64').toString())`
 : resolveCli;
const cli = process.env.EVALGATE_SDK_CLI ?? execFileSync(
 npxExecutable, ["--yes", "--package", sdk, "--", "node", "-e", resolveCliArgument],
 { encoding: "utf8", timeout: 120_000, shell: process.platform === "win32" },
).trim();
const invoke = (args, options = {}) => execFileSync(process.execPath, [resolve(cli), ...args], { encoding: "utf8", timeout: 30_000, ...options });

const caps = JSON.parse(
	invoke(["capabilities", "--format", "json"], {
		encoding: "utf8",
	}),
);
const known = new Set(caps.commandContract.commands.map((c) => c.command));

const files = [];
const walk = (d) =>
	readdirSync(d).forEach((f) => {
		const p = join(d, f);
		statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") && files.push(p);
	});
walk(join(root, "skills"));

const re =
	/(?:`|^\s*)(?:npx (?:-y )?@evalgate\/sdk(?:@[\w.-]+)? |evalgate )([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g;
const problems = [];
const helpCache = new Map();
for (const f of files) {
	readFileSync(f, "utf8")
		.split("\n")
		.forEach((line, i) => {
			for (const m of line.matchAll(re)) {
				if (!known.has(m[1])) {
					problems.push(`${f}:${i + 1} unknown command "${m[1]}"`);
					continue;
				}
				const help = (() => {
					try {
						const args = [m[1], ...(m[2] ? [m[2]] : []), "--help"];
						const key = args.join(" ");
						if (helpCache.has(key)) return helpCache.get(key);
						const output = invoke(
							args,
							{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
						);
						helpCache.set(key, output);
						return output;
					} catch (e) {
						return String(e.stdout ?? "") + String(e.stderr ?? "");
					}
				})();
				if (/COMMAND_REMOVED|unknown command/i.test(help)) {
					problems.push(
						`${f}:${i + 1} "${m[1]}${m[2] ? " " + m[2] : ""}" was removed`,
					);
				}
			}
		});
}

const snapshotPath = join(root, "evaluations/runtime-contract.json");
const snapshot = {
 sdkVersion: caps.sdkVersion,
 contractVersion: caps.contractVersion,
 capabilityCount: caps.capabilities.length,
 commands: [...known].sort(),
};
if (process.argv.includes("--update-ledger")) {
 writeFileSync(snapshotPath, JSON.stringify(snapshot, null, "\t") + "\n");
 const ledger = join(root, "evaluations/convergence-truth-ledger.md");
 writeFileSync(ledger, readFileSync(ledger, "utf8")
   .replace(/SDK(?:@|\s+)\d+\.\d+\.\d+/gu, `SDK ${caps.sdkVersion}`)
   .replace(/@evalgate\/sdk@\d+\.\d+\.\d+/gu, `@evalgate/sdk@${caps.sdkVersion}`)
   .replace(/\d+ capabilities, \d+ commands/gu, `${snapshot.capabilityCount} capabilities, ${known.size} commands`)
   .replace(/contract `[^`]+`/gu, `contract \`${caps.contractVersion}\``));
} else if (!existsSync(snapshotPath) || JSON.stringify(JSON.parse(readFileSync(snapshotPath, "utf8"))) !== JSON.stringify(snapshot)) {
 problems.push("runtime-contract.json differs from installed runtime; review check-commands.mjs --update-ledger");
}

const ledgerPath = join(root, "evaluations/convergence-truth-ledger.md");
if (!existsSync(ledgerPath)) {
	problems.push("evaluations/convergence-truth-ledger.md is missing");
} else {
	const ledger = readFileSync(ledgerPath, "utf8");
	const ledgerMatch = ledger.match(
		/@evalgate\/sdk@(\d+\.\d+\.\d+)|SDK\s+(\d+\.\d+\.\d+)/u,
	);
	const ledgerVersion = ledgerMatch?.[1] ?? ledgerMatch?.[2];
	if (!ledgerVersion) {
		problems.push(
			"convergence-truth-ledger.md does not record a concrete SDK version",
		);
	} else if (ledgerVersion !== caps.sdkVersion) {
		problems.push(
			`truth ledger SDK ${ledgerVersion} lags npm latest ${caps.sdkVersion}`,
		);
	}
	if (!ledger.includes(caps.contractVersion)) {
		problems.push(
			`truth ledger omits live contract version ${caps.contractVersion}`,
		);
	}
}

console.log(
	`SDK ${caps.sdkVersion}, contract ${caps.contractVersion}: checked ${files.length} files`,
);
if (problems.length) {
	console.error(problems.join("\n"));
	process.exit(1);
}
