import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { FIND_MESSAGE, FindStrings, findScript } from "../../src/find";
import { ISOLATED_CSP, prepareSrcdoc } from "../../src/strict";

const STRINGS: FindStrings = {
	placeholder: "Find in page",
	previous: "Previous match",
	next: "Next match",
	close: "Close",
	noResults: "No results",
};

const OPEN = "<script>";
const CLOSE = "</script>";

function body(script: string): string {
	assert.ok(script.startsWith(OPEN) && script.endsWith(CLOSE), "one script element");
	return script.slice(OPEN.length, -CLOSE.length);
}

test("findScript: a single script element that nothing inside can close or comment out", () => {
	const hostile: FindStrings = {
		placeholder: "</script><img src=x onerror=alert(1)>",
		previous: "<!--",
		next: "<script>",
		close: "</SCRIPT >",
		noResults: "  '\"`${x}",
	};
	for (const strings of [STRINGS, hostile]) {
		const inner = body(findScript(strings));
		assert.ok(!/<\/script|<script|<!--/i.test(inner), "no script or comment markup inside");
		assert.ok(!inner.includes("<img"), "the strings' < is escaped");
		// Parses as JavaScript.
		new vm.Script(inner);
	}
	assert.ok(body(findScript(STRINGS)).includes(JSON.stringify(FIND_MESSAGE)));
});

/** Runs the injected script against a stub window: it must be self-contained and only react to the exact message. */
test("findScript: self-contained, opens only on the plugin's exact message from the parent", () => {
	const listeners: Record<string, Array<{ fn: (e: unknown) => void; capture: unknown }>> = {};
	const parent = {};
	const created: string[] = [];
	const win = {
		parent,
		addEventListener(type: string, fn: (e: unknown) => void, capture?: unknown) {
			(listeners[type] ??= []).push({ fn, capture });
		},
	};
	const doc = {
		createElement(tag: string) {
			created.push(tag);
			throw new Error("stop: the bar was asked to open");
		},
	};
	vm.runInNewContext(body(findScript(STRINGS)), { window: win, document: doc });

	assert.deepEqual(Object.keys(listeners).sort(), ["keydown", "message"]);
	assert.equal(listeners.keydown[0].capture, true, "keydown in the capture phase, ahead of the page");

	const onMessage = listeners.message[0].fn;
	onMessage({ source: {}, data: FIND_MESSAGE }); // the page itself, or anyone but the parent
	onMessage({ source: parent, data: "something else" });
	onMessage({ source: parent, data: { type: FIND_MESSAGE } });
	assert.deepEqual(created, [], "ignored: wrong sender or wrong data");
	assert.throws(() => onMessage({ source: parent, data: FIND_MESSAGE }), /the bar was asked to open/);
	assert.deepEqual(created, ["hpv-find"]);
});

test("findScript: Ctrl/Cmd+F opens the bar, other keys are left to the page", () => {
	const listeners: Record<string, (e: unknown) => void> = {};
	let opened = 0;
	const win = { parent: {}, addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn) };
	const doc = {
		createElement() {
			opened += 1;
			throw new Error("open");
		},
	};
	vm.runInNewContext(body(findScript(STRINGS)), { window: win, document: doc });
	const key = (init: Record<string, unknown>) => {
		let prevented = false;
		const e = { key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init, preventDefault: () => (prevented = true), stopPropagation() {} };
		try {
			listeners.keydown(e);
		} catch {
			// The stub document stops the bar from building.
		}
		return prevented;
	};
	assert.equal(key({ key: "f" }), false);
	assert.equal(key({ key: "g", ctrlKey: true }), false, "find-next only while the bar is open");
	assert.equal(key({ key: "f", ctrlKey: true, altKey: true }), false);
	assert.equal(opened, 0);
	assert.equal(key({ key: "f", ctrlKey: true }), true);
	assert.equal(key({ key: "F", metaKey: true }), true);
	assert.equal(key({ key: "а", code: "KeyF", ctrlKey: true }), true, "other keyboard layouts");
	assert.equal(opened, 3);
});

test("prepareSrcdoc: the plugin's own script goes right after the CSP and base, before any of the file", () => {
	const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${ISOLATED_CSP}">`;
	const BASE = '<base href="about:srcdoc">';
	const script = findScript(STRINGS);
	const cases: Array<[string, string]> = [
		["", CSP_META + BASE + script],
		["<!doctype html><script>page()</script>", "<!doctype html>" + CSP_META + BASE + script + "<script>page()</script>"],
		["<script>early()</script><!doctype html>", CSP_META + BASE + script + "<script>early()</script><!doctype html>"],
		['<!doctype html><base href="x/">', "<!doctype html>" + CSP_META + script + '<base href="x/">'],
	];
	for (const [input, expected] of cases) {
		assert.equal(prepareSrcdoc(input, script).html, expected, JSON.stringify(input));
	}
	// Without it, nothing changes (embeds and tests that do not ask for it).
	assert.equal(prepareSrcdoc("<p>x", "").html, CSP_META + BASE + "<p>x");
});
