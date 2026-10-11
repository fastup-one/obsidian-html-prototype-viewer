/**
 * Automated desktop checks of html-prototype-viewer-strict in a real, isolated
 * Obsidian (see launch.mjs), on a vault made by scripts/make-test-vault.mjs.
 * Follows the same steps as the vault's LEEME.md. Prints PASS/FAIL lines,
 * writes report.json and screenshots to <outDir>. Uses Obsidian's internal
 * APIs (app.plugins, app.setting…) — test tooling only, never plugin code.
 *
 *   node test/obsidian/checks.mjs <port> <outDir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { SETTINGS_WINDOW, connect, sleep, waitFor } from "./cdp.mjs";

const ID = "html-prototype-viewer-strict";
const ISOLATED_FLAGS = "allow-scripts allow-forms";
const TRUSTED_FLAGS =
	"allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-same-origin";
const [port = "9333", outDir = "obsidian-check-output"] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const results = [];
function check(name, ok, evidence) {
	results.push({ name, ok: !!ok, evidence });
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  → ${JSON.stringify(evidence)}`}`);
}
async function attempt(name, fn) {
	try {
		await fn();
	} catch (error) {
		check(name, false, String(error?.message ?? error));
	}
}

const cdp = await connect(Number(port));
const js = (expr) => cdp.evaluate(expr);
const shot = async (name) => writeFileSync(join(outDir, `${name}.png`), await cdp.screenshot());

const inFrame = (expr, iframe = "__hpv.frame()") => cdp.frameEval(iframe, expr);

const HELPERS = `window.__hpv = {
	leaf: null,
	async open(path) {
		const file = app.vault.getAbstractFileByPath(path);
		if (!file) throw new Error("no file " + path);
		if (!this.leaf || !this.leaf.view || !this.leaf.parent) this.leaf = app.workspace.getLeaf(false);
		await this.leaf.openFile(file);
		app.workspace.setActiveLeaf(this.leaf, { focus: true });
		return true;
	},
	el() { return this.leaf.view.contentEl; },
	status() { return this.el().querySelector(".hpv-status")?.innerText ?? ""; },
	stage() { return this.el().querySelector(".hpv-stage, .hpv-embed-stage")?.innerText ?? ""; },
	frame() { return this.el().querySelector("iframe.hpv-frame"); },
	frames() { return this.el().querySelectorAll("iframe.hpv-frame").length; },
	frameInfo() {
		const f = this.frame();
		return f ? { sandbox: f.getAttribute("sandbox"), srcdoc: f.hasAttribute("srcdoc") ? f.srcdoc.slice(0, 400) : null, src: f.getAttribute("src") } : null;
	},
	async trusted() {
		try { return JSON.parse(await app.vault.adapter.read(".obsidian/plugins/${ID}/data.json")).trusted ?? {}; } catch { return {}; }
	},
	// Modals open in Obsidian's active window, which is the settings window while it is open (1.14+).
	modal() { return activeDocument.querySelector(".hpv-confirm-modal")?.innerText ?? null; },
	clickModal(text) {
		const b = [...activeDocument.querySelectorAll(".hpv-confirm-modal button")].find((b) => b.innerText.trim() === text);
		b?.click();
		return !!b;
	},
	cmd(id) { return app.commands.executeCommandById("${ID}:" + id); },
	notices() { return [...document.querySelectorAll(".notice")].map((n) => n.innerText).join(" | "); },
	file(path) { return app.vault.getAbstractFileByPath(path); },
};
true`;

async function ready() {
	await waitFor(() => js("!!(window.app && app.workspace && app.workspace.layoutReady)"), { timeoutMs: 60000, what: "Obsidian layout" });
}
async function pluginLoaded() {
	await waitFor(() => js(`!!app.plugins.plugins["${ID}"]`), { timeoutMs: 30000, what: "plugin load" });
	await js(HELPERS);
}
async function open(path) {
	await js(`__hpv.open(${JSON.stringify(path)})`);
	await waitFor(() => js("!!__hpv.frame() || /\\S/.test(__hpv.stage())"), { what: `render of ${path}` });
}
const frameTitle = () => inFrame("document.title");

// --- Setup: Obsidian's own vault-trust prompt, Spanish UI ---------------------

await ready();
const clickedVaultTrust = await js(`(() => {
	const b = [...document.querySelectorAll(".modal-container button")].find((b) => /trust author|confiar en el autor/i.test(b.innerText));
	b?.click();
	return !!b;
})()`);
check("plugins enabled (Obsidian's own 'trust the author of this vault' prompt clicked if shown)", true, { promptShown: clickedVaultTrust });
// Trusting the vault makes Obsidian 1.14 open its settings window, which then is the active window
// (where new modals go). Close it and give the main window the focus back, as a user would.
await sleep(1500);
await js(`app.setting?.close?.(); window.focus(); true`);
await waitFor(() => js("activeWindow === window"), { what: "main window active" });
await pluginLoaded();
if ((await js(`localStorage.getItem("language")`)) !== "es") {
	// Obsidian's own reload command; the language is kept in the test profile for later runs.
	await js(`localStorage.setItem("language", "es"); app.commands.executeCommandById("app:reload"); true`).catch(() => {});
	await sleep(4000);
	await ready();
	await pluginLoaded();
}
check("Obsidian UI in Spanish", (await js("moment.locale()")) === "es", await js("moment.locale()"));
check("plugin loaded with the strict id", await js(`app.plugins.manifests["${ID}"]?.version`), null);
console.log(`      Obsidian: ${await js("document.title")} · ${await js("navigator.userAgent.match(/Electron\\/[\\d.]+/)?.[0]")}`);

// --- 01: minimal HTML, isolated by default -------------------------------------

await attempt("01 minimal HTML renders isolated", async () => {
	await open("01-basico.html");
	const info = await js("__hpv.frameInfo()");
	await waitFor(async () => (await inFrame("document.body.innerText")).includes("Se ve el HTML"), { what: "01 text" });
	check("01 isolated iframe: srcdoc, exactly 'allow-scripts allow-forms', no src", info.sandbox === ISOLATED_FLAGS && info.srcdoc && !info.src, info);
	check("01 srcdoc starts with the no-network CSP", info.srcdoc.startsWith('<meta http-equiv="Content-Security-Policy" content="default-src \'none\';'), info.srcdoc.slice(0, 120));
	check("01 status shows 'Aislado'", (await js("__hpv.status()")).includes("Aislado"), await js("__hpv.status()"));
	check("01 origin is opaque", (await inFrame("self.origin")) === "null", await inFrame("self.origin"));
	await shot("01-basico");
});

// --- 02: isolation self-check ---------------------------------------------------

await attempt("02 isolation self-check is green", async () => {
	await open("02-aislamiento.html");
	const title = await waitFor(async () => { const t = await frameTitle(); return /VERDE|ROJO|ÁMBAR/.test(t) && t; }, { what: "02 verdict" });
	check("02 self-check: 🟢 VERDE (everything blocked)", title.includes("VERDE"), { title, rows: await inFrame("document.getElementById('list').innerText") });
	check("02 status lists blocked internet resource and features", /recurso\(s\) de internet/.test(await js("__hpv.status()")) && /ventanas nuevas/.test(await js("__hpv.status()")), await js("__hpv.status()"));
	await shot("02-aislamiento");
});

// --- 03: anchors stay inside the document --------------------------------------

await attempt("03 anchors", async () => {
	await open("03-anclas.html");
	await inFrame(`document.querySelector('a[href="#final"]').click(); true`);
	await sleep(500);
	const state = await inFrame("({ href: location.href, scrolled: scrollY > 0 })");
	check("03 anchor scrolls inside the page (about:srcdoc#final), frame kept", state.href === "about:srcdoc#final" && state.scrolled && (await js("!!__hpv.frame()")), state);
	await shot("03-anclas");
});

// --- 04: remote and neighbouring resources --------------------------------------

await attempt("04 external resources", async () => {
	await open("04-recursos-externos.html");
	const title = await waitFor(async () => { const t = await frameTitle(); return /VERDE|ROJO|aislamiento/.test(t) && t; }, { what: "04 verdict" });
	check("04 self-check: 🟢 VERDE (nothing from the internet loaded)", title.includes("VERDE"), title);
	const status = await js("__hpv.status()");
	check("04 notices: 3 internet resources blocked, 2 neighbouring files", status.includes("3 recurso(s) de internet bloqueado(s)") && status.includes("2 archivo(s) vecino(s)"), status);
	await shot("04-recursos-externos");
});

// --- 05: forms --------------------------------------------------------------------

await attempt("05 forms", async () => {
	await open("05-formulario.html");
	await inFrame(`document.querySelector("#local button").click(); document.querySelector("#remote button").click(); true`);
	await sleep(800);
	const r = await inFrame(`({ local: document.getElementById("localResult").innerText, remote: document.getElementById("remoteResult").innerText })`);
	check("05 form handled by the page works", r.local.includes("Funciona"), r);
	check("05 form sending data to the internet is blocked", r.remote.includes("Bloqueado"), r);
	check("05 frame still in place (no navigation)", await js("!!__hpv.frame()"), null);
	await shot("05-formulario");
});

// --- 06: leaving the document is stopped -------------------------------------------

await attempt("06 navigation is stopped", async () => {
	await open("06-salir-de-la-pagina.html");
	await inFrame(`document.getElementById("go").click(); true`);
	await waitFor(() => js("!__hpv.frame() && __hpv.stage().includes('intentó salir')"), { timeoutMs: 15000, what: "navigation notice" });
	check("06 frame removed and notice shown", true, await js("__hpv.stage()"));
	await shot("06-salir");
	await js(`[...__hpv.el().querySelectorAll(".hpv-error button")].find((b) => b.innerText.includes("Volver a cargar")).click(); true`);
	await waitFor(() => js("!!__hpv.frame()"), { what: "reloaded frame" });
	check("06 'Volver a cargar' brings the page back", true, null);
});

// --- Embedded block in a note ------------------------------------------------------

await attempt("embed in a note", async () => {
	await js(`__hpv.open("Nota con vista previa.md")`);
	await waitFor(() => js("!!__hpv.el().querySelector('.hpv-embed iframe.hpv-frame')"), { what: "embedded frame" });
	const embedFrame = `__hpv.el().querySelector(".hpv-embed iframe.hpv-frame")`;
	const title = await waitFor(async () => { const t = await cdp.frameEval(embedFrame, "document.title"); return /VERDE|ROJO|ÁMBAR/.test(t) && t; }, { what: "embed verdict" });
	const status = await js(`__hpv.el().querySelector(".hpv-embed .hpv-status").innerText`);
	const sandbox = await js(`${embedFrame}.getAttribute("sandbox")`);
	check("embed: isolated, 'Aislado' shown, self-check green", title.includes("VERDE") && status.includes("Aislado") && sandbox === ISOLATED_FLAGS, { title, status, sandbox });
	await shot("embed");
});

// --- Trust flow ------------------------------------------------------------------------

await attempt("trust flow", async () => {
	await open("07-confianza.html");
	check("07 isolated: cannot store anything", (await inFrame("document.body.innerText")).includes("no puede guardar nada"), null);

	check("trust command available on an isolated file", await js(`__hpv.cmd("trust-prototype")`), null);
	const modal = await waitFor(() => js("__hpv.modal()"), { what: "trust dialog" });
	check("dialog shows path, size, fingerprint and the mobile warning",
		modal.includes("07-confianza.html") && /Tamaño/.test(modal) && /Huella\s*\n?\s*[0-9a-f]{12}/.test(modal) && modal.includes("en el móvil, podría acceder a tu vault"), modal);
	await shot("trust-dialog");
	const focused = await waitFor(async () => { const t = await js("activeDocument.activeElement?.innerText?.trim()"); return t === "Cancelar" && t; }, { timeoutMs: 2000, what: "focus on Cancelar" }).catch(() => null);
	check("Cancel has the focus", focused === "Cancelar", await js("activeDocument.activeElement?.outerHTML?.slice(0, 120)"));
	// A real key press: keyDown with text also produces the keypress that activates a focused button.
	await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
	await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
	await waitFor(() => js("__hpv.modal() === null"), { what: "dialog closed" });
	await sleep(300);
	check("Enter cancels (focus on Cancelar): nothing trusted", Object.keys(await js("__hpv.trusted()")).length === 0 && (await js("__hpv.status()")).includes("Aislado"), await js("__hpv.trusted()"));

	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "trust dialog (focus test)" });
	await sleep(200);
	await js(`[...activeDocument.querySelectorAll(".hpv-confirm-modal button")].find((b) => b.innerText.trim() === "Confiar").focus(); activeDocument.querySelector(".hpv-confirm-modal").focus(); true`);
	await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
	await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
	await waitFor(() => js("__hpv.modal() === null"), { what: "dialog closed (2)" });
	await sleep(300);
	check("Enter cancels even with the focus elsewhere in the dialog", Object.keys(await js("__hpv.trusted()")).length === 0, await js("__hpv.trusted()"));

	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "trust dialog (2)" });
	await js(`__hpv.clickModal("Confiar")`);
	await waitFor(() => js("__hpv.status().includes('Sin aislamiento')"), { what: "trusted status" });
	const info = await js("__hpv.frameInfo()");
	check("trusted: upstream iframe (src, upstream flags + allow-same-origin, no srcdoc)", info.sandbox === TRUSTED_FLAGS && info.src && !info.srcdoc, info);
	const trusted = await js("__hpv.trusted()");
	check("trusted entry saved with the content hash", /^[0-9a-f]{64}$/.test(trusted["07-confianza.html"]?.sha256 ?? ""), trusted);
	await waitFor(async () => (await inFrame("document.body.innerText")).includes("1 vez"), { what: "first visit" });
	await shot("trusted");
	await js(`__hpv.cmd("reload-prototype")`);
	await waitFor(async () => (await inFrame("document.body.innerText")).includes("2 vez"), { what: "second visit" });
	check("trusted: storage works (visit counter goes up after reload)", true, null);

	const original = await js(`app.vault.read(__hpv.file("07-confianza.html"))`);
	await js(`app.vault.modify(__hpv.file("07-confianza.html"), ${JSON.stringify(original + "\n<!-- changed -->\n")}).then(() => true)`);
	await waitFor(() => js("__hpv.status().includes('cambió desde que confiaste')"), { what: "changed notice" });
	check("content changed: back to isolated with a notice", (await js("__hpv.frameInfo()")).sandbox === ISOLATED_FLAGS, await js("__hpv.status()"));
	await shot("changed");

	await js(`app.vault.modify(__hpv.file("07-confianza.html"), ${JSON.stringify(original)}).then(() => true)`);
	await waitFor(() => js("__hpv.status().includes('Sin aislamiento')"), { what: "trusted again" });
	check("original content restored: trusted again (trust is bound to the hash)", true, null);

	await js(`app.vault.createFolder("carpeta").catch(() => {}).then(() => app.fileManager.renameFile(__hpv.file("07-confianza.html"), "carpeta/07-renombrado.html")).then(() => true)`);
	await waitFor(async () => Object.keys(await js("__hpv.trusted()")).includes("carpeta/07-renombrado.html"), { what: "trust follows rename" });
	await sleep(500);
	check("rename/move keeps the trust", (await js("__hpv.status()")).includes("Sin aislamiento") && !Object.keys(await js("__hpv.trusted()")).includes("07-confianza.html"), await js("__hpv.trusted()"));

	await js(`[...__hpv.leaf.view.containerEl.querySelectorAll(".view-action")].find((a) => (a.getAttribute("aria-label") || "").includes("retirar la confianza")).click(); true`);
	await waitFor(() => js("__hpv.status().includes('Aislado')"), { what: "revoked" });
	check("shield button revokes at once, without a dialog", (await js("__hpv.modal()")) === null && Object.keys(await js("__hpv.trusted()")).length === 0, await js("__hpv.trusted()"));
	await js(`app.fileManager.renameFile(__hpv.file("carpeta/07-renombrado.html"), "07-confianza.html").then(() => true)`);
});

// --- Trusted on desktop: amber, then settings and revoke all ---------------------------------

await attempt("trusted self-check and settings", async () => {
	await open("02-aislamiento.html");
	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "trust dialog (02)" });
	await js(`__hpv.clickModal("Confiar")`);
	const title = await waitFor(async () => { const t = await frameTitle(); return /ÁMBAR|ROJO/.test(t) && t; }, { what: "02 trusted verdict" });
	check("02 trusted on desktop: 🟠 ÁMBAR (no access to Obsidian)", title.includes("ÁMBAR"), { title, rows: await inFrame("document.getElementById('list').innerText") });
	await shot("02-trusted");

	await js(`app.setting.open(); app.setting.openTabById("${ID}"); true`);
	const win = await connect(Number(port), SETTINGS_WINDOW, { timeoutMs: 15000 });
	const text = await waitFor(async () => { const t = await win.evaluate(`document.querySelector(".vertical-tab-content")?.innerText ?? ""`); return /sin cambios/.test(t) && t; }, { what: "settings statuses" });
	check("settings: isolation explained, trusted list with status", text.includes("Aislamiento") && text.includes("Archivos de confianza") && text.includes("02-aislamiento.html") && text.includes("sin cambios"), text.slice(0, 600));
	check("settings: trust date in Obsidian's language", /\d{1,2} oct 2026/.test(text) && !/\b(AM|PM)\b/.test(text), text.match(/Confiado el [^·]*/)?.[0]);
	check("settings: no switch to disable isolation", !/Isolation stricte|Strict isolation|Aislamiento estricto/.test(text), null);
	writeFileSync(join(outDir, "settings.png"), await win.screenshot());
	await win.evaluate(`[...document.querySelectorAll(".vertical-tab-content .setting-item")].find((s) => s.querySelector(".setting-item-name")?.innerText.trim() === "Retirar todos").click(); true`);
	// The confirmation opens in the settings window, Obsidian's active window at that moment.
	const dialog = await waitFor(() => win.evaluate(`document.querySelector(".hpv-confirm-modal")?.innerText ?? ""`), { what: "revoke-all dialog" });
	check("'Retirar todos' asks for confirmation first", /¿Retirar la confianza a todos/.test(dialog), dialog);
	await win.evaluate(`[...document.querySelectorAll(".hpv-confirm-modal button")].find((b) => b.innerText.trim() === "Retirar todos").click(); true`);
	win.close();
	await waitFor(async () => Object.keys(await js("__hpv.trusted()")).length === 0, { what: "revoke all" });
	check("'Retirar todos' (with confirmation) empties the list", true, null);
	await js(`app.setting.close(); true`);
	await waitFor(async () => (await frameTitle()).includes("VERDE"), { what: "02 isolated again" });
	check("02 isolated again after 'Retirar todos'", true, null);
});

// --- Upstream settings never grant trust ----------------------------------------------------------

await attempt("upstream settings", async () => {
	await js(`app.vault.adapter.write(".obsidian/plugins/${ID}/data.json", JSON.stringify({ viewport: "full", autoReload: true, strictIsolation: false, embedHeight: 600 })).then(() => true)`);
	await js(`app.plugins.disablePlugin("${ID}").then(() => app.plugins.enablePlugin("${ID}")).then(() => true)`);
	await pluginLoaded();
	const settings = await js(`({ keys: Object.keys(app.plugins.plugins["${ID}"].settings), trusted: Object.keys(app.plugins.plugins["${ID}"].settings.trusted) })`);
	check("data.json with strictIsolation:false loads with no global switch and no trust", !settings.keys.includes("strictIsolation") && settings.trusted.length === 0, settings);
	await open("02-aislamiento.html");
	await waitFor(async () => (await frameTitle()).includes("VERDE"), { what: "02 isolated" });
	check("…and files still open isolated", true, null);
});

// --- Fast switching never shows an older file -----------------------------------------------------

await attempt("fast switching", async () => {
	await js(`__hpv.open("01-basico.html"); __hpv.open("04-recursos-externos.html"); __hpv.open("03-anclas.html").then(() => true)`);
	await sleep(2000);
	// Obsidian decides which of the concurrent opens wins; the plugin must show exactly that file, once.
	const expected = { "01-basico.html": "Se ve el HTML", "04-recursos-externos.html": "intenta cargar", "03-anclas.html": "Prueba de anclas" };
	const state = await js(`({ file: __hpv.leaf.view.file?.path, title: __hpv.frame()?.getAttribute("title"), frames: __hpv.frames() })`);
	const text = await inFrame("document.body.innerText");
	check("fast switching: the frame shows the tab's current file, and only one frame",
		state.frames === 1 && state.title === state.file?.replace(/\.html$/, "") && text.includes(expected[state.file]), { ...state, text: text.slice(0, 60) });
});

// --- No errors from the plugin ---------------------------------------------------------------------

const pluginErrors = cdp.logs.filter((l) => l.where === "main" && (l.type === "exception" || l.type === "error") && /hpv|html-prototype|plugin:/i.test(l.text));
check("no errors from the plugin in Obsidian's console", pluginErrors.length === 0, pluginErrors.slice(0, 5));

writeFileSync(join(outDir, "report.json"), JSON.stringify({ results, logs: cdp.logs }, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
cdp.close();
process.exit(failed ? 1 : 0);
