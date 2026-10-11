/**
 * Forbidden-API sweep of the built bundle (main.js). Fails when it finds network
 * access, dynamic code, frame messaging, Node/Electron access, HTML injection
 * sinks or any URL. Generic for any Obsidian plugin repo.
 *
 * A plugin that genuinely needs one of these lists it in packaging.json, with the
 * reason, after the operator approved it:
 *   "bundleAllow": [{ "rule": "requestUrl", "reason": "talks to AnkiConnect on 127.0.0.1" }]
 *
 *   npm run build && node scripts/check-bundle.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const RULES = {
	"fetch": /\bfetch\s*\(/,
	"XMLHttpRequest": /XMLHttpRequest/,
	"WebSocket": /WebSocket/,
	"EventSource": /EventSource/,
	"sendBeacon": /sendBeacon/,
	"requestUrl": /\brequestUrl\b/,
	"eval": /\beval\s*\(/,
	"Function constructor": /\bnew\s+Function\b|\bFunction\s*\(/,
	"postMessage": /postMessage/,
	"importScripts": /importScripts/,
	"require other than obsidian": /\brequire\(\s*["'](?!obsidian["'])[^"']*["']\s*\)/,
	"child_process": /child_process/,
	"electron": /\belectron\b/,
	"HTML injection sink": /\.(?:innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write\s*\(/,
	"URL": /\bhttps?:\/\//,
};

const configPath = join(ROOT, "packaging.json");
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
const allowed = new Map((config.bundleAllow ?? []).map((entry) => [entry.rule, entry.reason]));
for (const [rule, reason] of allowed) {
	if (!(rule in RULES)) throw new Error(`packaging.json: unknown bundleAllow rule "${rule}"`);
	if (!reason) throw new Error(`packaging.json: bundleAllow "${rule}" needs a reason`);
}

const bundlePath = join(ROOT, "main.js");
if (!existsSync(bundlePath)) {
	console.error("Missing main.js — run `npm run build` first.");
	process.exit(1);
}
const lines = readFileSync(bundlePath, "utf8").split("\n");

let failures = 0;
for (const [rule, re] of Object.entries(RULES)) {
	const hits = [];
	lines.forEach((line, i) => {
		if (re.test(line)) hits.push(`main.js:${i + 1}: ${line.trim().slice(0, 120)}`);
	});
	if (hits.length === 0) {
		console.log(`ok       ${rule}`);
	} else if (allowed.has(rule)) {
		console.log(`allowed  ${rule} (${hits.length}) — ${allowed.get(rule)}`);
	} else {
		failures += 1;
		console.log(`FAIL     ${rule} (${hits.length})`);
		for (const hit of hits.slice(0, 5)) console.log(`         ${hit}`);
	}
}
if (failures > 0) {
	console.error(`\n${failures} forbidden API rule(s) matched. Remove them, or get the exception approved and list it in packaging.json.`);
	process.exit(1);
}
console.log("\nBundle sweep clean.");
