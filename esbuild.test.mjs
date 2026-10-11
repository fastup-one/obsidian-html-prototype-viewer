// Bundles the unit tests for `node --test`. `obsidian` is deliberately not
// marked external: a pure module that imports it fails to bundle here.
import esbuild from "esbuild";
import { readdirSync } from "node:fs";

const entryPoints = readdirSync("test/unit")
	.filter((name) => name.endsWith(".test.ts"))
	.map((name) => `test/unit/${name}`);

await esbuild.build({
	entryPoints,
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node20",
	outdir: "test-dist",
	outExtension: { ".js": ".mjs" },
	sourcemap: "inline",
	logLevel: "warning",
});
