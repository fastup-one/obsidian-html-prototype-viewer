import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/settings-model";

const H1 = "a".repeat(64);

test("upstream settings with strictIsolation: false never grant trust", () => {
	const s = normalizeSettings({ viewport: "tablet", autoReload: false, strictIsolation: false, embedHeight: 400 });
	assert.deepEqual(Object.keys(s.trusted), []);
	assert.equal("strictIsolation" in s, false);
	assert.equal(s.viewport, "tablet");
	assert.equal(s.autoReload, false);
	assert.equal(s.embedHeight, 400);
});

test("upstream settings with strictIsolation: true load the same way", () => {
	const s = normalizeSettings({ strictIsolation: true });
	assert.deepEqual(Object.keys(s.trusted), []);
	assert.equal("strictIsolation" in s, false);
});

test("missing or garbage data falls back to defaults", () => {
	for (const raw of [null, undefined, 7, "x", [], {}]) {
		const s = normalizeSettings(raw);
		assert.equal(s.viewport, DEFAULT_SETTINGS.viewport);
		assert.equal(s.autoReload, DEFAULT_SETTINGS.autoReload);
		assert.equal(s.embedHeight, DEFAULT_SETTINGS.embedHeight);
		assert.deepEqual(Object.keys(s.trusted), []);
	}
	const bad = normalizeSettings({ viewport: "huge", autoReload: "yes", embedHeight: -5, trusted: "everything" });
	assert.equal(bad.viewport, DEFAULT_SETTINGS.viewport);
	assert.equal(bad.autoReload, DEFAULT_SETTINGS.autoReload);
	assert.equal(bad.embedHeight, DEFAULT_SETTINGS.embedHeight);
	assert.deepEqual(Object.keys(bad.trusted), []);
	assert.equal(normalizeSettings({ embedHeight: 2.5 }).embedHeight, DEFAULT_SETTINGS.embedHeight);
});

test("valid trusted entries survive a save/load round trip", () => {
	const saved = JSON.parse(
		JSON.stringify({ trusted: { "p/a.html": { sha256: H1, trustedAt: "2026-10-11T12:00:00.000Z" } } }),
	);
	const s = normalizeSettings(saved);
	assert.deepEqual(Object.keys(s.trusted), ["p/a.html"]);
	assert.equal(s.trusted["p/a.html"].sha256, H1);
});
