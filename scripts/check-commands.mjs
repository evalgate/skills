#!/usr/bin/env node
// Fails CI when a skill names an EvalGate CLI command the latest SDK doesn't ship,
// or when the truth ledger records an SDK version older than npm latest.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sdk = process.env.EVALGATE_SDK ?? "@evalgate/sdk@latest";
const caps = JSON.parse(
	execFileSync("npx", ["-y", sdk, "capabilities", "--format", "json"], {
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
						return execFileSync(
							"npx",
							["-y", sdk, m[1], ...(m[2] ? [m[2]] : []), "--help"],
							{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
						);
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
