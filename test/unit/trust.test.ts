import { test } from "node:test";
import assert from "node:assert/strict";
import {
	TrustStore,
	decideMode,
	emptyStore,
	getEntry,
	removePath,
	renamePath,
	revoke,
	sanitizeStore,
	touchesPath,
	trust,
} from "../../src/trust";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const NOW = new Date("2026-10-11T12:00:00.000Z");

function store(entries: Record<string, string>): TrustStore {
	let s = emptyStore();
	for (const [path, hash] of Object.entries(entries)) s = trust(s, path, hash, NOW);
	return s;
}

const keys = (s: TrustStore) => Object.keys(s).sort();

test("decideMode", () => {
	const s = store({ "a.html": H1 });
	assert.equal(decideMode("a.html", H1, s), "trusted");
	assert.equal(decideMode("a.html", H2, s), "isolated-changed");
	assert.equal(decideMode("b.html", H1, s), "isolated");
	assert.equal(decideMode("a.html", H1, emptyStore()), "isolated");
});

test("prototype keys are plain paths, never inherited", () => {
	const s = emptyStore();
	for (const path of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
		assert.equal(decideMode(path, H1, s), "isolated", path);
		assert.equal(getEntry(s, path), undefined, path);
	}
	const t = trust(s, "__proto__", H1, NOW);
	assert.equal(decideMode("__proto__", H1, t), "trusted");
	assert.equal(Object.getPrototypeOf(t), null);
	assert.deepEqual(keys(t), ["__proto__"]);
});

test("trust records hash and date, and refuses bad input", () => {
	const s = trust(emptyStore(), "x/y.html", H1, NOW);
	assert.deepEqual({ ...s["x/y.html"] }, { sha256: H1, trustedAt: "2026-10-11T12:00:00.000Z" });
	assert.throws(() => trust(emptyStore(), "", H1));
	assert.throws(() => trust(emptyStore(), "a.html", "not-a-hash"));
	assert.throws(() => trust(emptyStore(), "a.html", H1.toUpperCase()));
});

test("operations never mutate their input", () => {
	const s = store({ "a.html": H1, "d/b.html": H2 });
	const before = JSON.stringify(s);
	trust(s, "c.html", H1);
	revoke(s, "a.html");
	renamePath(s, "d", "e");
	removePath(s, "d");
	assert.equal(JSON.stringify(s), before);
});

test("touchesPath: file, folder and similar prefixes", () => {
	const s = store({ "a/b/x.html": H1, "z.html": H1 });
	assert.equal(touchesPath(s, "z.html"), true);
	assert.equal(touchesPath(s, "a/b"), true);
	assert.equal(touchesPath(s, "a"), true);
	assert.equal(touchesPath(s, "a/bc"), false);
	assert.equal(touchesPath(s, "z.htm"), false);
	assert.equal(touchesPath(emptyStore(), "z.html"), false);
});

test("revoke", () => {
	const s = store({ "a.html": H1, "b.html": H2 });
	assert.deepEqual(keys(revoke(s, "a.html")), ["b.html"]);
	assert.deepEqual(keys(revoke(s, "missing.html")), ["a.html", "b.html"]);
});

test("renamePath: file", () => {
	const s = renamePath(store({ "a.html": H1, "b.html": H2 }), "a.html", "sub/z.html");
	assert.deepEqual(keys(s), ["b.html", "sub/z.html"]);
	assert.equal(s["sub/z.html"].sha256, H1);
});

test("renamePath: folder, without touching similar prefixes", () => {
	const s = renamePath(store({ "a/b/x.html": H1, "a/bc/y.html": H2, "a/b": H2, "z.html": H1 }), "a/b", "n/m");
	assert.deepEqual(keys(s), ["a/bc/y.html", "n/m", "n/m/x.html", "z.html"]);
});

test("renamePath: a moved entry replaces the one at its destination", () => {
	const s = renamePath(store({ "a.html": H1, "b.html": H2 }), "a.html", "b.html");
	assert.deepEqual(keys(s), ["b.html"]);
	assert.equal(s["b.html"].sha256, H1);
});

test("removePath: file and folder, without touching similar prefixes", () => {
	const s = store({ "a/b/x.html": H1, "a/bc/y.html": H2, "a/b": H2, "z.html": H1 });
	assert.deepEqual(keys(removePath(s, "a/b")), ["a/bc/y.html", "z.html"]);
	assert.deepEqual(keys(removePath(s, "z.html")), ["a/b", "a/b/x.html", "a/bc/y.html"]);
});

test("sanitizeStore keeps valid entries and drops garbage", () => {
	for (const garbage of [null, undefined, 42, "str", true, [], [{ sha256: H1, trustedAt: NOW.toISOString() }]]) {
		assert.deepEqual(keys(sanitizeStore(garbage)), [], String(garbage));
	}
	const raw: Record<string, unknown> = JSON.parse(
		JSON.stringify({
			"ok.html": { sha256: H1, trustedAt: "2026-10-11T12:00:00.000Z", extra: 1 },
			"": { sha256: H1, trustedAt: "2026-10-11T12:00:00.000Z" },
			"short.html": { sha256: "abc", trustedAt: "2026-10-11T12:00:00.000Z" },
			"upper.html": { sha256: H1.toUpperCase(), trustedAt: "2026-10-11T12:00:00.000Z" },
			"nodate.html": { sha256: H1 },
			"baddate.html": { sha256: H1, trustedAt: "yesterday-ish" },
			"num.html": { sha256: 123, trustedAt: "2026-10-11T12:00:00.000Z" },
			"null.html": null,
			"arr.html": [H1],
			"str.html": H1,
		}),
	);
	// An own "__proto__" key, as JSON.parse produces it (plain assignment would set the prototype instead).
	Object.defineProperty(raw, "__proto__", {
		value: { sha256: H2, trustedAt: "2026-10-11T12:00:00.000Z" },
		enumerable: true,
		configurable: true,
		writable: true,
	});
	const s = sanitizeStore(raw);
	assert.deepEqual(keys(s), ["__proto__", "ok.html"]);
	assert.deepEqual({ ...s["ok.html"] }, { sha256: H1, trustedAt: "2026-10-11T12:00:00.000Z" });
	assert.equal(Object.getPrototypeOf(s), null);
});

test("sanitizeStore: JSON with a __proto__ key cannot pollute prototypes", () => {
	const raw: unknown = JSON.parse(`{"__proto__": {"sha256": "${H1}", "trustedAt": "2026-10-11T12:00:00.000Z"}}`);
	const s = sanitizeStore(raw);
	assert.equal(decideMode("__proto__", H1, s), "trusted");
	assert.equal(({} as Record<string, unknown>).sha256, undefined);
	assert.equal(decideMode("other.html", H1, s), "isolated");
});
