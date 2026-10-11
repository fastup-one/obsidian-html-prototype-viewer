/**
 * Starts or stops an isolated Obsidian for automated checks: a virtual display
 * (Xvfb), its own profile (--user-data-dir) and a test vault, with DevTools on
 * 127.0.0.1 only. Never touches the operator's profile or vaults.
 *
 *   node test/obsidian/launch.mjs start <profileDir> <vaultDir> [port]
 *   node test/obsidian/launch.mjs stop <profileDir>
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

const DISPLAY = ":99";

const vaultId = (path) => createHash("sha256").update(path).digest("hex").slice(0, 16);

async function start(profileDir, vaultDir, port) {
	const profile = resolve(profileDir);
	await mkdir(profile, { recursive: true });
	await writeFile(
		join(profile, "obsidian.json"),
		// A vault id derived from the path: a new test vault is new to Obsidian too.
		JSON.stringify({ vaults: { [vaultId(resolve(vaultDir))]: { path: resolve(vaultDir), ts: Date.now(), open: true } } }) + "\n",
	);
	const pids = [];
	if (!existsSync(`/tmp/.X${DISPLAY.slice(1)}-lock`)) {
		const xvfb = spawn("Xvfb", [DISPLAY, "-screen", "0", "1280x800x24", "-nolisten", "tcp"], {
			detached: true,
			stdio: "ignore",
		});
		xvfb.unref();
		pids.push(xvfb.pid);
		await new Promise((r) => setTimeout(r, 1000));
	}
	const obsidian = spawn(
		"obsidian",
		[`--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "--remote-allow-origins=http://127.0.0.1"],
		{ detached: true, stdio: "ignore", env: { ...process.env, DISPLAY } },
	);
	obsidian.unref();
	pids.unshift(obsidian.pid);
	await writeFile(join(profile, ".pids.json"), JSON.stringify(pids) + "\n");
	console.log(`Obsidian started (pids ${pids.join(", ")}), DevTools on 127.0.0.1:${port}`);
}

async function stop(profileDir) {
	const file = join(resolve(profileDir), ".pids.json");
	if (!existsSync(file)) return console.log("Nothing to stop.");
	for (const pid of JSON.parse(await readFile(file, "utf8"))) {
		try {
			process.kill(-pid, "SIGTERM");
		} catch {
			try {
				process.kill(pid, "SIGTERM");
			} catch {
				/* already gone */
			}
		}
	}
	await writeFile(file, "[]\n");
	console.log("Stopped.");
}

const [command, profileDir, vaultDir, port = "9333"] = process.argv.slice(2);
if (command === "start" && profileDir && vaultDir) await start(profileDir, vaultDir, Number(port));
else if (command === "stop" && profileDir) await stop(profileDir);
else {
	console.error("Usage: launch.mjs start <profileDir> <vaultDir> [port] | stop <profileDir>");
	process.exit(1);
}
