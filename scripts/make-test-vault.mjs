/**
 * Assembles a throwaway Obsidian vault for testing: the built plugin, enabled,
 * plus the self-checking fixtures from test/fixtures/vault.
 *
 * Refuses to write into a folder that already has content, so it can never
 * touch a real vault.
 *
 *   npm run build && node scripts/make-test-vault.mjs <empty-or-new-folder>
 */
import { access, copyFile, cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACTS = ["main.js", "manifest.json", "styles.css"];

async function main() {
	const arg = process.argv[2];
	if (!arg) throw new Error("Usage: node scripts/make-test-vault.mjs <empty-or-new-folder>");
	const vault = resolve(arg);

	try {
		if ((await readdir(vault)).length > 0) throw new Error(`Refusing to write into a non-empty folder: ${vault}`);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}

	for (const name of ARTIFACTS) {
		try {
			await access(join(ROOT, name));
		} catch {
			throw new Error(`Missing ${name} — run \`npm run build\` first.`);
		}
	}

	await cp(join(ROOT, "test", "fixtures", "vault"), vault, { recursive: true });

	const { id } = JSON.parse(await readFile(join(ROOT, "manifest.json"), "utf8"));
	const pluginDir = join(vault, ".obsidian", "plugins", id);
	await mkdir(pluginDir, { recursive: true });
	for (const name of ARTIFACTS) await copyFile(join(ROOT, name), join(pluginDir, name));
	await writeFile(join(vault, ".obsidian", "community-plugins.json"), JSON.stringify([id], null, 2) + "\n");

	console.log(`Test vault ready: ${vault}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
