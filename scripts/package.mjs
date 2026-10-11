/**
 * Builds the distribution package from the current build, deterministically:
 *
 *   <out>/<id>-<version>/<id>/main.js, manifest.json, styles.css   ← the plugin folder to install
 *   <out>/<id>-<version>/<extra files listed in packaging.json>
 *   <out>/<id>-<version>/SHA256SUMS
 *   <out>/<id>-<version>.zip
 *
 * The zip is stored (no compression), with fixed timestamps, permissions and order, so the
 * same build gives the same bytes on any machine: a zip built locally and one built by the
 * release workflow can be compared by hash. Generic for any Obsidian plugin repo; extras and
 * bundle exceptions live in packaging.json. Node built-ins only.
 *
 *   npm run build && node scripts/package.mjs [--out <dir>]   (default: dist)
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { crc32 } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_FILES = ["main.js", "manifest.json", "styles.css"];
const TEXT_FILE = /\.(md|html|txt)$/i;

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function outDir() {
	const i = process.argv.indexOf("--out");
	return resolve(i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : join(ROOT, "dist"));
}

/** A stored zip with directory entries, 1980-01-01 timestamps and Unix permissions: byte-for-byte reproducible. */
function storedZip(entries) {
	if (typeof crc32 !== "function") throw new Error("node:zlib crc32 is missing: use Node 20.15+ or 22.2+.");
	const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
	const parts = [];
	const central = [];
	let offset = 0;
	for (const { path, data } of entries) {
		const name = Buffer.from(path, "utf8");
		const isDir = path.endsWith("/");
		const body = isDir ? Buffer.alloc(0) : data;
		const crc = isDir ? 0 : crc32(body) >>> 0;

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(10, 4); // version needed: 1.0 (stored)
		local.writeUInt16LE(0x0800, 6); // UTF-8 names
		local.writeUInt16LE(0, 8); // method: stored
		local.writeUInt16LE(0, 10); // time 00:00:00
		local.writeUInt16LE(DOS_DATE, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(body.length, 18);
		local.writeUInt32LE(body.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28);
		parts.push(local, name, body);

		const header = Buffer.alloc(46);
		header.writeUInt32LE(0x02014b50, 0);
		header.writeUInt16LE((3 << 8) | 30, 4); // made by: Unix, spec 3.0
		header.writeUInt16LE(10, 6);
		header.writeUInt16LE(0x0800, 8);
		header.writeUInt16LE(0, 10);
		header.writeUInt16LE(0, 12);
		header.writeUInt16LE(DOS_DATE, 14);
		header.writeUInt32LE(crc, 16);
		header.writeUInt32LE(body.length, 20);
		header.writeUInt32LE(body.length, 24);
		header.writeUInt16LE(name.length, 28);
		header.writeUInt16LE(0, 30); // extra
		header.writeUInt16LE(0, 32); // comment
		header.writeUInt16LE(0, 34); // disk
		header.writeUInt16LE(0, 36); // internal attributes
		header.writeUInt32LE(isDir ? ((0o40755 << 16) | 0x10) >>> 0 : (0o100644 << 16) >>> 0, 38);
		header.writeUInt32LE(offset, 42);
		central.push(header, name);

		offset += local.length + name.length + body.length;
	}
	const directory = Buffer.concat(central);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(directory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...parts, directory, end]);
}

async function main() {
	const manifest = JSON.parse(await readFile(join(ROOT, "manifest.json"), "utf8"));
	const configPath = join(ROOT, "packaging.json");
	const config = existsSync(configPath) ? JSON.parse(await readFile(configPath, "utf8")) : {};
	const name = `${manifest.id}-${manifest.version}`;

	const files = new Map();
	for (const file of PLUGIN_FILES) {
		const path = join(ROOT, file);
		if (!existsSync(path)) {
			if (file === "styles.css") continue;
			throw new Error(`Missing ${file} — run \`npm run build\` first.`);
		}
		files.set(`${manifest.id}/${file}`, await readFile(path));
	}
	for (const [target, source] of Object.entries(config.files ?? {})) {
		let data = await readFile(join(ROOT, source));
		if (TEXT_FILE.test(target)) data = Buffer.from(data.toString("utf8").replaceAll("{{version}}", manifest.version));
		files.set(target, data);
	}
	const sorted = [...files.keys()].sort();
	files.set("SHA256SUMS", Buffer.from(sorted.map((path) => `${sha256(files.get(path))}  ${path}\n`).join("")));

	const out = outDir();
	const folder = join(out, name);
	await rm(folder, { recursive: true, force: true });
	for (const [path, data] of files) {
		await mkdir(dirname(join(folder, path)), { recursive: true });
		await writeFile(join(folder, path), data);
	}

	const paths = [...files.keys()];
	const dirs = new Set([`${name}/`]);
	for (const path of paths) {
		const parts = path.split("/").slice(0, -1);
		for (let i = 1; i <= parts.length; i++) dirs.add(`${name}/${parts.slice(0, i).join("/")}/`);
	}
	const entries = [
		...[...dirs].map((path) => ({ path, data: Buffer.alloc(0) })),
		...paths.map((path) => ({ path: `${name}/${path}`, data: files.get(path) })),
	].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
	const zip = storedZip(entries);
	const zipPath = join(out, `${name}.zip`);
	await writeFile(zipPath, zip);

	process.stdout.write(files.get("SHA256SUMS").toString("utf8"));
	console.log(`${sha256(zip)}  ${zipPath}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
