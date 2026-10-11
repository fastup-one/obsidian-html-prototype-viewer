import { test } from "node:test";
import assert from "node:assert/strict";
import {
	ISOLATED_CSP,
	UPSTREAM_SANDBOX_FLAGS,
	assertSrcdocSafe,
	classifyUrl,
	cssUrls,
	prepareSrcdoc,
	reviewHtml,
	sandboxFlags,
	scanScript,
	srcsetUrls,
} from "../../src/strict";

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${ISOLATED_CSP}">`;
const BASE = '<base href="about:srcdoc">';

test("trusted mode is exactly the upstream non-strict sandbox", () => {
	// Upstream 1.0.1 frame.ts: SANDBOX_FLAGS + "allow-same-origin" when strict isolation is off.
	assert.deepEqual(sandboxFlags("trusted"), [
		"allow-scripts",
		"allow-forms",
		"allow-popups",
		"allow-popups-to-escape-sandbox",
		"allow-modals",
		"allow-downloads",
		"allow-same-origin",
	]);
	assert.deepEqual(sandboxFlags("trusted"), [...UPSTREAM_SANDBOX_FLAGS, "allow-same-origin"]);
});

test("isolated mode grants exactly allow-scripts and allow-forms", () => {
	assert.deepEqual(sandboxFlags("isolated"), ["allow-scripts", "allow-forms"]);
	for (const forbidden of [
		"allow-same-origin",
		"allow-popups",
		"allow-popups-to-escape-sandbox",
		"allow-modals",
		"allow-downloads",
		"allow-top-navigation",
		"allow-top-navigation-by-user-activation",
	]) {
		assert.ok(!sandboxFlags("isolated").includes(forbidden), forbidden);
	}
});

test("sandboxFlags returns a fresh array each time", () => {
	const flags = sandboxFlags("isolated");
	flags.push("allow-same-origin");
	assert.deepEqual(sandboxFlags("isolated"), ["allow-scripts", "allow-forms"]);
});

test("assertSrcdocSafe refuses allow-same-origin", () => {
	assert.doesNotThrow(() => assertSrcdocSafe(sandboxFlags("isolated")));
	assert.throws(() => assertSrcdocSafe(sandboxFlags("trusted")));
	assert.throws(() => assertSrcdocSafe(["allow-same-origin"]));
});

test("the CSP blocks every network fetch and form submission", () => {
	assert.equal(
		ISOLATED_CSP,
		"default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
			"img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'",
	);
	assert.ok(!/https?:|\*|'self'/.test(ISOLATED_CSP));
});

/** Checks the invariants that hold for every prepared document. */
function checkPrepared(input: string, out: string) {
	assert.equal(out.split(CSP_META).length - 1, 1, "CSP injected exactly once");
	const cspAt = out.indexOf(CSP_META);
	const firstScript = out.search(/<script/i);
	if (firstScript !== -1) assert.ok(cspAt < firstScript, "CSP before the first script");
	const body = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
	assert.equal(out.replace(CSP_META, "").replace(BASE, ""), body, "nothing else changes");
}

test("prepareSrcdoc: injection point", () => {
	const cases: Array<[string, string]> = [
		["", CSP_META + BASE],
		["hola", CSP_META + BASE + "hola"],
		['<body style="background:red">hola</body>', CSP_META + BASE + '<body style="background:red">hola</body>'],
		["<!doctype html><p>x", "<!doctype html>" + CSP_META + BASE + "<p>x"],
		["<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 4.01//EN\"><HEAD lang=x>", '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">' + CSP_META + BASE + "<HEAD lang=x>"],
		["  \n<!doctype html><html>", "  \n<!doctype html>" + CSP_META + BASE + "<html>"],
		["<!-- c --><!doctype html><html>", "<!-- c --><!doctype html>" + CSP_META + BASE + "<html>"],
		['<?xml version="1.0"?>\n<!DOCTYPE html><html>', '<?xml version="1.0"?>\n<!DOCTYPE html>' + CSP_META + BASE + "<html>"],
		["<html><head><title>t</title></head>", CSP_META + BASE + "<html><head><title>t</title></head>"],
	];
	for (const [input, expected] of cases) {
		const { html } = prepareSrcdoc(input);
		assert.equal(html, expected, JSON.stringify(input));
		checkPrepared(input, html);
	}
});

test("prepareSrcdoc: BOM is dropped and does not hide the doctype", () => {
	const input = "﻿<!doctype html><p>x";
	const { html } = prepareSrcdoc(input);
	assert.equal(html, "<!doctype html>" + CSP_META + BASE + "<p>x");
	checkPrepared(input, html);
});

test("prepareSrcdoc: a script before the doctype still comes after the CSP", () => {
	const input = "<script>fetch('https://example.com')</script><!doctype html><p>x";
	const { html } = prepareSrcdoc(input);
	assert.ok(html.startsWith(CSP_META));
	checkPrepared(input, html);
});

test("prepareSrcdoc: an unterminated comment does not move the injection point", () => {
	const input = "<!-- never closed <!doctype html><script>x()</script>";
	const { html } = prepareSrcdoc(input);
	assert.ok(html.startsWith(CSP_META));
	checkPrepared(input, html);
});

test("prepareSrcdoc: existing <base href> keeps the CSP but skips our base", () => {
	const input = '<!doctype html><head><base href="https://example.com/"></head>';
	const { html, injectedBase } = prepareSrcdoc(input);
	assert.equal(injectedBase, false);
	assert.equal(html, "<!doctype html>" + CSP_META + '<head><base href="https://example.com/"></head>');
	assert.equal(prepareSrcdoc("<BASE TARGET=_self HREF='x/'>").injectedBase, false);
	// A <base> without href, or one inside a comment, does not count.
	assert.equal(prepareSrcdoc("<base target=_blank>").injectedBase, true);
	assert.equal(prepareSrcdoc('<!-- <base href="x"> --><p>').injectedBase, true);
});

test("prepareSrcdoc: the file's own CSP does not prevent ours", () => {
	const input = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src *">`;
	const { html } = prepareSrcdoc(input);
	checkPrepared(input, html);
	assert.ok(html.indexOf(CSP_META) < html.indexOf("default-src *"));
});

test("prepareSrcdoc: large and non-ASCII documents", () => {
	const big = "<!doctype html><p>" + "ñ€🧪".repeat(40_000) + "</p>";
	const { html } = prepareSrcdoc(big);
	checkPrepared(big, html);
	assert.ok(html.length > 160_000);
});

test("classifyUrl", () => {
	const cases: Array<[string, string]> = [
		["style.css", "relative"],
		["./img/a.png", "relative"],
		["../x.html", "relative"],
		["/abs/path.js", "relative"],
		["img with spaces.png", "relative"],
		["  padded.png  ", "relative"],
		["http://example.com/a", "remote"],
		["HTTPS://EXAMPLE.COM", "remote"],
		["//cdn.example.com/x.js", "remote"],
		["wss://example.com", "remote"],
		["app://local/x", "remote"],
		["file:///etc/passwd", "remote"],
		["data:image/png;base64,AAAA", "inline"],
		["blob:null/1234", "inline"],
		["mailto:a@b.c", "ignored"],
		["tel:+34600000000", "ignored"],
		["#section", "ignored"],
		["about:blank", "ignored"],
		["javascript:alert(1)", "ignored"],
		["", "ignored"],
		["   ", "ignored"],
	];
	for (const [url, expected] of cases) assert.equal(classifyUrl(url), expected, url);
});

test("srcsetUrls", () => {
	assert.deepEqual(srcsetUrls("a.png 1x, b.png 2x"), ["a.png", "b.png"]);
	assert.deepEqual(srcsetUrls(" https://x.com/a.png 480w ,  //y.com/b.png 800w "), ["https://x.com/a.png", "//y.com/b.png"]);
	assert.deepEqual(srcsetUrls("single.png"), ["single.png"]);
	assert.deepEqual(srcsetUrls("data:image/png;base64,AA,BB 1x"), ["data:image/png;base64,AA,BB 1x"]);
	assert.deepEqual(srcsetUrls(""), []);
});

test("cssUrls", () => {
	assert.deepEqual(
		cssUrls(`@import "a.css"; @import 'https://fonts.example/b.css';
			body { background: url(bg.png) } .x { background-image: URL( "https://x.com/y.png" ) }
			.y { src: url('font.woff2') } .z { background: url(data:image/png;base64,AA) }`),
		["bg.png", "https://x.com/y.png", "font.woff2", "data:image/png;base64,AA", "a.css", "https://fonts.example/b.css"],
	);
	assert.deepEqual(cssUrls("body { color: red }"), []);
	assert.deepEqual(cssUrls(`a { background: url() } b { background: url("") } c { background: url( spaced.png ) }`), [
		"spaced.png",
	]);
	assert.deepEqual(cssUrls(`a { background: url("we(i)rd).png") }`), ["we(i)rd).png"]);
});

test("scanScript: positives", () => {
	assert.equal(scanScript("window.open('x')").popups, true);
	assert.equal(scanScript("self . open ( u )").popups, true);
	assert.equal(scanScript("alert('hi')").modals, true);
	assert.equal(scanScript("if (confirm('ok?')) go()").modals, true);
	assert.equal(scanScript("x = window.prompt('n')").modals, true);
	assert.equal(scanScript("location = 'https://x'").navigation, true);
	assert.equal(scanScript("window.location.href='https://x'").navigation, true);
	assert.equal(scanScript("location.assign(u)").navigation, true);
	assert.equal(scanScript("document.location.replace(u)").navigation, true);
	assert.equal(scanScript("a.download = 'file.csv'").downloads, true);
});

test("scanScript: negatives", () => {
	const quiet = { popups: false, modals: false, navigation: false, downloads: false };
	assert.deepEqual(scanScript("document.open(); xhr.open('GET', u)"), quiet);
	assert.deepEqual(scanScript("myalert(1); dialog.confirm(); obj.prompt()"), quiet);
	assert.deepEqual(scanScript("if (location.href == x) {} const l = location.hash"), quiet);
	assert.deepEqual(scanScript("if (a.download === b) {}"), quiet);
	assert.deepEqual(scanScript(""), quiet);
});

test("reviewHtml: a plain page is clean", () => {
	const r = reviewHtml(`<!doctype html><style>.top .menu { top: 0 } .parent .child {}</style><p>Hello</p><a href="#top">top</a>`);
	assert.deepEqual(r, { hostAccess: false, obsidianApi: false, dynamicCode: false, obfuscation: false, storage: false, remoteHosts: [] });
});

test("reviewHtml: flags each behaviour", () => {
	assert.equal(reviewHtml("<script>parent.document.body</script>").hostAccess, true);
	assert.equal(reviewHtml("<script>window.top.location = x</script>").hostAccess, true);
	assert.equal(reviewHtml("<script>var f = frameElement;</script>").hostAccess, true);
	assert.equal(reviewHtml("<script>opener.postMessage(1, '*')</script>").hostAccess, true);
	assert.equal(reviewHtml("<script>app.vault.getFiles()</script>").obsidianApi, true);
	assert.equal(reviewHtml("<script>const fs = require('fs')</script>").obsidianApi, true);
	assert.equal(reviewHtml("<script>eval(code)</script>").dynamicCode, true);
	assert.equal(reviewHtml("<script>new Function('return 1')</script>").dynamicCode, true);
	assert.equal(reviewHtml("<script>setTimeout('run()', 10)</script>").dynamicCode, true);
	assert.equal(reviewHtml("<script>atob(x)</script>").obfuscation, true);
	assert.equal(reviewHtml("<script>var s = '" + "QUJD".repeat(600) + "';</script>").obfuscation, true);
	assert.equal(reviewHtml("<script>String.fromCharCode(" + Array(30).fill("65").join(",") + ")</script>").obfuscation, true);
	assert.equal(reviewHtml("<script>localStorage.setItem('k', 1)</script>").storage, true);
	assert.equal(reviewHtml("<script>indexedDB.open('db')</script>").storage, true);
});

test("reviewHtml: remote hosts, deduplicated and sorted", () => {
	const r = reviewHtml(`<link href="https://Fonts.GoogleAPIs.com/css?x"><script src="//cdn.example.org/a.js"></script>
		<script>fetch("https://api.example.org:8443/v1"); fetch("https://fonts.googleapis.com/b")</script>
		<a href="http://localhost/x">no dot, not a host</a> // a comment.with.dots`);
	assert.deepEqual(r.remoteHosts, ["api.example.org", "cdn.example.org", "fonts.googleapis.com"]);
});

test("reviewHtml: setTimeout with a function is not dynamic code", () => {
	assert.equal(reviewHtml("<script>setTimeout(function () {}, 10); setTimeout(() => go(), 5)</script>").dynamicCode, false);
});
