/**
 * Automated desktop checks of html-prototype-viewer-strict in a real, isolated
 * Obsidian (see launch.mjs), on a vault made by scripts/make-test-vault.mjs.
 * Follows the same steps as the vault's README.md, with Obsidian's interface in
 * English (default) or Spanish. Prints PASS/FAIL lines, writes report.json and
 * screenshots to <outDir>. Uses Obsidian's internal APIs (app.plugins,
 * app.setting…) — test tooling only, never plugin code.
 *
 *   node test/obsidian/checks.mjs <port> <outDir> [en|es]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { SETTINGS_WINDOW, connect, sleep, waitFor } from "./cdp.mjs";

const ID = "html-prototype-viewer-strict";
const ISOLATED_FLAGS = "allow-scripts allow-forms";
const TRUSTED_FLAGS =
	"allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-same-origin";
const [port = "9333", outDir = "obsidian-check-output", lang = "en"] = process.argv.slice(2);

/** The plugin's interface strings the checks rely on, per Obsidian language. */
const UI = {
	en: {
		isolated: "Isolated",
		trusted: "Not isolated",
		remote3: "3 internet resource(s) blocked",
		relative2: "2 neighbouring file(s)",
		remoteAny: "internet resource(s) blocked",
		popups: "new windows",
		navigated: "tried to leave its own document",
		reload: "Reload",
		changed: "changed since you trusted it",
		size: "Size",
		fingerprint: "Fingerprint",
		mobile: "approved for your phone",
		cancel: "Cancel",
		trust: "Trust",
		revokeAria: "revoke trust",
		isolation: "Isolation",
		trustedFiles: "Trusted files",
		unchanged: "unchanged",
		revokeAll: "Revoke all",
		revokeAllTitle: "Revoke trust for every file?",
		reviewHost: "Tries to reach the window around it",
		reviewStorage: "Stores data in the browser",
		phoneWarning: "FULL access to your vault",
		fullAccess: "Full vault access",
		unapproved: "has not approved this exact content",
		needsApproval: "Trust this file on your computer first",
		withdrawn: "is isolated again: your computer withdrew its approval",
		date: (text) => /[A-Z][a-z]{2} \d{1,2}, 2026/.test(text),
	},
	es: {
		isolated: "Aislado",
		trusted: "Sin aislamiento",
		remote3: "3 recurso(s) de internet bloqueado(s)",
		relative2: "2 archivo(s) vecino(s)",
		remoteAny: "recurso(s) de internet",
		popups: "ventanas nuevas",
		navigated: "intentó salir",
		reload: "Volver a cargar",
		changed: "cambió desde que confiaste",
		size: "Tamaño",
		fingerprint: "Huella",
		mobile: "aprobado para tu móvil",
		cancel: "Cancelar",
		trust: "Confiar",
		revokeAria: "retirar la confianza",
		isolation: "Aislamiento",
		trustedFiles: "Archivos de confianza",
		unchanged: "sin cambios",
		revokeAll: "Retirar todos",
		revokeAllTitle: "¿Retirar la confianza a todos",
		reviewHost: "Intenta llegar a la ventana que lo rodea",
		reviewStorage: "Guarda datos en el navegador",
		phoneWarning: "acceso COMPLETO a tu vault",
		fullAccess: "Acceso completo al vault",
		unapproved: "no ha aprobado este contenido exacto",
		needsApproval: "Primero confía en este archivo en tu ordenador",
		withdrawn: "vuelve a estar aislado: tu ordenador retiró su aprobación",
		date: (text) => /\d{1,2} [a-z]{3} 2026/.test(text) && !/\b(AM|PM)\b/.test(text),
	},
}[lang];
if (!UI) throw new Error(`Unknown language "${lang}" (en | es)`);
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
	async approvals() {
		try { return JSON.parse(await app.vault.adapter.read(".obsidian/plugins/${ID}/approvals.json")).approvals ?? null; } catch { return null; }
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

// --- Setup: Obsidian's own vault-trust prompt, interface language ---------------

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
if (((await js(`localStorage.getItem("language")`)) ?? "en") !== lang) {
	// Obsidian's own reload command; the language is kept in the test profile for later runs.
	await js(`localStorage.setItem("language", ${JSON.stringify(lang)}); app.commands.executeCommandById("app:reload"); true`).catch(() => {});
	await sleep(4000);
	await ready();
	await pluginLoaded();
}
check(`Obsidian UI language: ${lang}`, (await js("moment.locale()")).startsWith(lang), await js("moment.locale()"));
check("plugin loaded with the strict id", await js(`app.plugins.manifests["${ID}"]?.version`), null);
console.log(`      Obsidian: ${await js("document.title")} · ${await js("navigator.userAgent.match(/Electron\\/[\\d.]+/)?.[0]")}`);

// --- 01: minimal HTML, isolated by default -------------------------------------

await attempt("01 minimal HTML renders isolated", async () => {
	await open("01-basic.html");
	const info = await js("__hpv.frameInfo()");
	await waitFor(async () => (await inFrame("document.body.innerText")).includes("The HTML is shown"), { what: "01 text" });
	check("01 isolated iframe: srcdoc, exactly 'allow-scripts allow-forms', no src", info.sandbox === ISOLATED_FLAGS && info.srcdoc && !info.src, info);
	check("01 srcdoc starts with the no-network CSP", info.srcdoc.startsWith('<meta http-equiv="Content-Security-Policy" content="default-src \'none\';'), info.srcdoc.slice(0, 120));
	check(`01 status shows '${UI.isolated}'`, (await js("__hpv.status()")).includes(UI.isolated), await js("__hpv.status()"));
	check("01 origin is opaque", (await inFrame("self.origin")) === "null", await inFrame("self.origin"));
	await shot("01-basic");
});

// --- 02: isolation self-check ---------------------------------------------------

await attempt("02 isolation self-check is green", async () => {
	await open("02-isolation.html");
	const title = await waitFor(async () => { const t = await frameTitle(); return /GREEN|RED|AMBER/.test(t) && t; }, { what: "02 verdict" });
	check("02 self-check: 🟢 GREEN (everything blocked)", title.includes("GREEN"), { title, rows: await inFrame("document.getElementById('list').innerText") });
	check("02 status lists blocked internet resource and features", (await js("__hpv.status()")).includes(UI.remoteAny) && (await js("__hpv.status()")).includes(UI.popups), await js("__hpv.status()"));
	await shot("02-isolation");
});

// --- 03: anchors stay inside the document --------------------------------------

await attempt("03 anchors", async () => {
	await open("03-anchors.html");
	await inFrame(`document.querySelector('a[href="#end"]').click(); true`);
	await sleep(500);
	const state = await inFrame("({ href: location.href, scrolled: scrollY > 0 })");
	check("03 anchor scrolls inside the page (about:srcdoc#end), frame kept", state.href === "about:srcdoc#end" && state.scrolled && (await js("!!__hpv.frame()")), state);
	await shot("03-anchors");
});

// --- 04: remote and neighbouring resources --------------------------------------

await attempt("04 external resources", async () => {
	await open("04-external-resources.html");
	const title = await waitFor(async () => { const t = await frameTitle(); return /GREEN|RED|isolated/.test(t) && t; }, { what: "04 verdict" });
	check("04 self-check: 🟢 GREEN (nothing from the internet loaded)", title.includes("GREEN"), title);
	const status = await js("__hpv.status()");
	check("04 notices: 3 internet resources blocked, 2 neighbouring files", status.includes(UI.remote3) && status.includes(UI.relative2), status);
	await shot("04-external-resources");
});

// --- 05: forms --------------------------------------------------------------------

await attempt("05 forms", async () => {
	await open("05-forms.html");
	await inFrame(`document.querySelector("#local button").click(); document.querySelector("#remote button").click(); true`);
	await sleep(800);
	const r = await inFrame(`({ local: document.getElementById("localResult").innerText, remote: document.getElementById("remoteResult").innerText })`);
	check("05 form handled by the page works", r.local.includes("Works"), r);
	check("05 form sending data to the internet is blocked", r.remote.includes("Blocked"), r);
	check("05 frame still in place (no navigation)", await js("!!__hpv.frame()"), null);
	await shot("05-forms");
});

// --- 06: leaving the document is stopped -------------------------------------------

await attempt("06 navigation is stopped", async () => {
	await open("06-leave-the-page.html");
	await inFrame(`document.getElementById("go").click(); true`);
	await waitFor(() => js(`!__hpv.frame() && __hpv.stage().includes(${JSON.stringify(UI.navigated)})`), { timeoutMs: 15000, what: "navigation notice" });
	check("06 frame removed and notice shown", true, await js("__hpv.stage()"));
	await shot("06-leave-the-page");
	await js(`[...__hpv.el().querySelectorAll(".hpv-error button")].find((b) => b.innerText.includes(${JSON.stringify(UI.reload)})).click(); true`);
	await waitFor(() => js("!!__hpv.frame()"), { what: "reloaded frame" });
	check(`06 '${UI.reload}' brings the page back`, true, null);
});

// --- Embedded block in a note ------------------------------------------------------

await attempt("embed in a note", async () => {
	await js(`__hpv.open("Note with preview.md")`);
	await waitFor(() => js("!!__hpv.el().querySelector('.hpv-embed iframe.hpv-frame')"), { what: "embedded frame" });
	const embedFrame = `__hpv.el().querySelector(".hpv-embed iframe.hpv-frame")`;
	const title = await waitFor(async () => { const t = await cdp.frameEval(embedFrame, "document.title"); return /GREEN|RED|AMBER/.test(t) && t; }, { what: "embed verdict" });
	const status = await js(`__hpv.el().querySelector(".hpv-embed .hpv-status").innerText`);
	const sandbox = await js(`${embedFrame}.getAttribute("sandbox")`);
	check(`embed: isolated, '${UI.isolated}' shown, self-check green`, title.includes("GREEN") && status.includes(UI.isolated) && sandbox === ISOLATED_FLAGS, { title, status, sandbox });
	await shot("embed");
});

// --- Trust flow ------------------------------------------------------------------------

await attempt("trust flow", async () => {
	await open("07-trust.html");
	check("07 isolated: cannot store anything", (await inFrame("document.body.innerText")).includes("cannot store anything"), null);

	check("trust command available on an isolated file", await js(`__hpv.cmd("trust-prototype")`), null);
	const modal = await waitFor(() => js("__hpv.modal()"), { what: "trust dialog" });
	check("dialog review lists browser storage for 07", modal.includes(UI.reviewStorage), modal);
	check("desktop dialog has no acknowledgement checkbox", !(await js("!!activeDocument.querySelector('.hpv-confirm-modal .hpv-ack')")), null);
	check("dialog shows path, size, fingerprint and the mobile warning",
		modal.includes("07-trust.html") && modal.includes(UI.size) && new RegExp(`${UI.fingerprint}\\s*\\n?\\s*[0-9a-f]{12}`).test(modal) && modal.includes(UI.mobile), modal);
	await shot("trust-dialog");
	const focused = await waitFor(async () => { const t = await js("activeDocument.activeElement?.innerText?.trim()"); return t === UI.cancel && t; }, { timeoutMs: 2000, what: "focus on Cancel" }).catch(() => null);
	check("Cancel has the focus", focused === UI.cancel, await js("activeDocument.activeElement?.outerHTML?.slice(0, 120)"));
	// A real key press: keyDown with text also produces the keypress that activates a focused button.
	await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
	await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
	await waitFor(() => js("__hpv.modal() === null"), { what: "dialog closed" });
	await sleep(300);
	check("Enter cancels (focus on Cancel): nothing trusted", Object.keys(await js("__hpv.trusted()")).length === 0 && (await js("__hpv.status()")).includes(UI.isolated), await js("__hpv.trusted()"));

	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "trust dialog (focus test)" });
	await sleep(200);
	await js(`[...activeDocument.querySelectorAll(".hpv-confirm-modal button")].find((b) => b.innerText.trim() === ${JSON.stringify(UI.trust)}).focus(); activeDocument.querySelector(".hpv-confirm-modal").focus(); true`);
	await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
	await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
	await waitFor(() => js("__hpv.modal() === null"), { what: "dialog closed (2)" });
	await sleep(300);
	check("Enter cancels even with the focus elsewhere in the dialog", Object.keys(await js("__hpv.trusted()")).length === 0, await js("__hpv.trusted()"));

	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "trust dialog (2)" });
	await js(`__hpv.clickModal(${JSON.stringify(UI.trust)})`);
	await waitFor(() => js(`__hpv.status().includes(${JSON.stringify(UI.trusted)})`), { what: "trusted status" });
	const info = await js("__hpv.frameInfo()");
	check("trusted: upstream iframe (src, upstream flags + allow-same-origin, no srcdoc)", info.sandbox === TRUSTED_FLAGS && info.src && !info.srcdoc, info);
	const trusted = await js("__hpv.trusted()");
	check("trusted entry saved with the content hash", /^[0-9a-f]{64}$/.test(trusted["07-trust.html"]?.sha256 ?? ""), trusted);
	const approvals = await js("__hpv.approvals()");
	check("desktop writes approvals.json: the trusted content's hash, for the phone", approvals && approvals[trusted["07-trust.html"]?.sha256]?.path === "07-trust.html" && Object.keys(approvals).length === 1, approvals);
	await waitFor(async () => (await inFrame("document.body.innerText")).includes("1 time"), { what: "first visit" });
	await shot("trusted");
	await js(`__hpv.cmd("reload-prototype")`);
	await waitFor(async () => (await inFrame("document.body.innerText")).includes("2 time"), { what: "second visit" });
	check("trusted: storage works (visit counter goes up after reload)", true, null);

	const original = await js(`app.vault.read(__hpv.file("07-trust.html"))`);
	await js(`app.vault.modify(__hpv.file("07-trust.html"), ${JSON.stringify(original + "\n<!-- changed -->\n")}).then(() => true)`);
	await waitFor(() => js(`__hpv.status().includes(${JSON.stringify(UI.changed)})`), { what: "changed notice" });
	check("content changed: back to isolated with a notice", (await js("__hpv.frameInfo()")).sandbox === ISOLATED_FLAGS, await js("__hpv.status()"));
	await shot("changed");

	await js(`app.vault.modify(__hpv.file("07-trust.html"), ${JSON.stringify(original)}).then(() => true)`);
	await waitFor(() => js(`__hpv.status().includes(${JSON.stringify(UI.trusted)})`), { what: "trusted again" });
	check("original content restored: trusted again (trust is bound to the hash)", true, null);

	await js(`app.vault.createFolder("folder").catch(() => {}).then(() => app.fileManager.renameFile(__hpv.file("07-trust.html"), "folder/07-renamed.html")).then(() => true)`);
	await waitFor(async () => Object.keys(await js("__hpv.trusted()")).includes("folder/07-renamed.html"), { what: "trust follows rename" });
	await sleep(500);
	check("approval follows the rename (same hash, new path)", Object.values((await js("__hpv.approvals()")) ?? {}).some((a) => a.path === "folder/07-renamed.html"), await js("__hpv.approvals()"));
	check("rename/move keeps the trust", (await js("__hpv.status()")).includes(UI.trusted) && !Object.keys(await js("__hpv.trusted()")).includes("07-trust.html"), await js("__hpv.trusted()"));

	await js(`[...__hpv.leaf.view.containerEl.querySelectorAll(".view-action")].find((a) => (a.getAttribute("aria-label") || "").includes(${JSON.stringify(UI.revokeAria)})).click(); true`);
	await waitFor(() => js(`__hpv.status().includes(${JSON.stringify(UI.isolated)})`), { what: "revoked" });
	check("shield button revokes at once, without a dialog", (await js("__hpv.modal()")) === null && Object.keys(await js("__hpv.trusted()")).length === 0, await js("__hpv.trusted()"));
	check("revoking withdraws the approval for the phone", Object.keys((await js("__hpv.approvals()")) ?? { x: 1 }).length === 0, await js("__hpv.approvals()"));
	await js(`app.fileManager.renameFile(__hpv.file("folder/07-renamed.html"), "07-trust.html").then(() => true)`);
});

// --- Trusted on desktop: amber, then settings and revoke all ---------------------------------

await attempt("trusted self-check and settings", async () => {
	await open("02-isolation.html");
	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "trust dialog (02)" });
	await js(`__hpv.clickModal(${JSON.stringify(UI.trust)})`);
	const title = await waitFor(async () => { const t = await frameTitle(); return /AMBER|RED/.test(t) && t; }, { what: "02 trusted verdict" });
	check("02 trusted on desktop: 🟠 AMBER (no access to Obsidian)", title.includes("AMBER"), { title, rows: await inFrame("document.getElementById('list').innerText") });
	await shot("02-trusted");

	await js(`app.setting.open(); app.setting.openTabById("${ID}"); true`);
	const win = await connect(Number(port), SETTINGS_WINDOW, { timeoutMs: 15000 });
	const text = await waitFor(async () => { const t = await win.evaluate(`document.querySelector(".vertical-tab-content")?.innerText ?? ""`); return t.includes(UI.unchanged) && t; }, { what: "settings statuses" });
	check("settings: isolation explained, trusted list with status", text.includes(UI.isolation) && text.includes(UI.trustedFiles) && text.includes("02-isolation.html") && text.includes(UI.unchanged), text.slice(0, 600));
	check("settings: trust date in Obsidian's language", UI.date(text), text.match(/02-isolation\.html\n[^\n]*/)?.[0]);
	check("settings: no switch to disable isolation", !/Isolation stricte|Strict isolation|Aislamiento estricto/.test(text), null);
	writeFileSync(join(outDir, "settings.png"), await win.screenshot());
	await win.evaluate(`[...document.querySelectorAll(".vertical-tab-content .setting-item")].find((s) => s.querySelector(".setting-item-name")?.innerText.trim() === ${JSON.stringify(UI.revokeAll)}).click(); true`);
	// The confirmation opens in the settings window, Obsidian's active window at that moment.
	const dialog = await waitFor(() => win.evaluate(`document.querySelector(".hpv-confirm-modal")?.innerText ?? ""`), { what: "revoke-all dialog" });
	check(`'${UI.revokeAll}' asks for confirmation first`, dialog.includes(UI.revokeAllTitle), dialog);
	await win.evaluate(`[...document.querySelectorAll(".hpv-confirm-modal button")].find((b) => b.innerText.trim() === ${JSON.stringify(UI.revokeAll)}).click(); true`);
	win.close();
	await waitFor(async () => Object.keys(await js("__hpv.trusted()")).length === 0, { what: "revoke all" });
	check(`'${UI.revokeAll}' (with confirmation) empties the list`, true, null);
	await waitFor(async () => Object.keys((await js("__hpv.approvals()")) ?? { x: 1 }).length === 0, { what: "approvals emptied" });
	check(`'${UI.revokeAll}' also withdraws every approval`, true, null);
	await js(`app.setting.close(); true`);
	await waitFor(async () => (await frameTitle()).includes("GREEN"), { what: "02 isolated again" });
	check(`02 isolated again after '${UI.revokeAll}'`, true, null);
});

// --- A page that reaches for Obsidian: blocked, and flagged by the review ---------------------------

await attempt("08 reaches for Obsidian", async () => {
	await open("08-reaches-obsidian.html");
	const title = await waitFor(async () => { const t = await frameTitle(); return /GREEN|RED/.test(t) && t; }, { what: "08 verdict" });
	check("08 isolated: its attempt to list the vault is blocked (GREEN)", title.includes("GREEN"), title);
	await js(`__hpv.cmd("trust-prototype")`);
	const modal = await waitFor(() => js("__hpv.modal()"), { what: "08 trust dialog" });
	check("08 trust dialog review warns that it reaches for Obsidian", modal.includes(UI.reviewHost) && (await js("!!activeDocument.querySelector('.hpv-review li.is-danger')")), modal);
	await shot("08-review");
	await js(`__hpv.clickModal(${JSON.stringify(UI.cancel)})`);
	await waitFor(() => js("__hpv.modal() === null"), { what: "08 dialog closed" });
	check("08 cancelled: nothing trusted, no approval", Object.keys(await js("__hpv.trusted()")).length === 0 && Object.keys((await js("__hpv.approvals()")) ?? {}).length === 0, null);
});

// --- Phone rule, simulated on desktop ---------------------------------------------------------------
// The plugin has no switch for this: the test flips the instance's platform fields (test tooling only).

await attempt("phone rule (simulated)", async () => {
	const P = `app.plugins.plugins["${ID}"]`;
	const q = (text) => JSON.stringify(text);
	const phoneMode = (on) => js(`(${P}.requiresApproval = ${on}, ${P}.writesApprovals = ${!on}, true)`);
	const trustButton = `[...activeDocument.querySelectorAll(".hpv-confirm-modal button")].find((b) => b.innerText.trim() === ${q(UI.trust)})`;

	await phoneMode(false);
	await open("07-trust.html");
	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "desktop trust dialog" });
	await js(`__hpv.clickModal(${q(UI.trust)})`);
	await waitFor(async () => Object.keys((await js("__hpv.approvals()")) ?? {}).length === 1, { what: "desktop approval" });

	await phoneMode(true);
	await js(`${P}.revokePath("07-trust.html").then(() => true)`);
	check("phone: its own trust list is empty, the desktop approval is there", Object.keys(await js(`${P}.settings.trusted`)).length === 0 && Object.keys((await js("__hpv.approvals()")) ?? {}).length === 1, await js("__hpv.approvals()"));

	await js(`__hpv.cmd("trust-prototype")`);
	const modal = await waitFor(() => js("__hpv.modal()"), { what: "phone trust dialog" });
	const state = await js(`({ hasAck: !!activeDocument.querySelector(".hpv-confirm-modal .hpv-ack input"), disabled: ${trustButton}.disabled })`);
	check("phone dialog: full-access warning, Trust disabled until the checkbox is ticked", modal.includes(UI.phoneWarning) && state.hasAck && state.disabled, { modal, state });
	await shot("phone-dialog");
	await js(`(activeDocument.querySelector(".hpv-confirm-modal .hpv-ack input").click(), true)`);
	check("phone dialog: the checkbox enables Trust", !(await js(`${trustButton}.disabled`)), null);
	await js(`__hpv.clickModal(${q(UI.trust)})`);
	await waitFor(() => js(`__hpv.status().includes(${q(UI.fullAccess)})`), { what: "full access label" });
	check(`phone: trusted, labelled '${UI.fullAccess}'`, (await js("__hpv.frameInfo()")).sandbox === TRUSTED_FLAGS, await js("__hpv.status()"));
	await shot("phone-trusted");

	// The computer withdraws the approval; the sync writes the file. No reload: the periodic re-check must catch it.
	const approvedBefore = await js("__hpv.approvals()");
	await js(`(document.querySelectorAll(".notice").forEach((n) => n.remove()), true)`);
	await js(`app.vault.adapter.write(".obsidian/plugins/${ID}/approvals.json", JSON.stringify({ version: 1, approvals: {} })).then(() => true)`);
	await js(`${P}.recheckApprovals().then(() => true)`);
	await waitFor(async () => (await js("__hpv.frameInfo()"))?.sandbox === ISOLATED_FLAGS, { what: "isolated after withdrawal", timeoutMs: 10000 });
	check("phone: approval withdrawn on the computer → the re-check isolates the open file",
		!(await js(`__hpv.status().includes(${q(UI.fullAccess)})`)), await js("__hpv.status()"));
	check("phone: the withdrawal also cancels the phone's own confirmation, and says so",
		Object.keys(await js(`${P}.settings.trusted`)).length === 0 && (await js("__hpv.notices()")).includes(UI.withdrawn), await js("__hpv.notices()"));
	await shot("phone-withdrawn");

	// The computer approves the same content again: the phone must NOT go back to trusted by itself.
	await js(`app.vault.adapter.write(".obsidian/plugins/${ID}/approvals.json", ${q(JSON.stringify({ version: 1, approvals: approvedBefore }))}).then(() => true)`);
	await js(`${P}.recheckApprovals().then(() => true)`);
	await sleep(1500);
	check("phone: re-approved on the computer → still isolated until confirmed again on the phone",
		Object.keys((await js("__hpv.approvals()")) ?? {}).length === 1 && (await js("__hpv.frameInfo()")).sandbox === ISOLATED_FLAGS && Object.keys(await js(`${P}.settings.trusted`)).length === 0,
		{ approvals: await js("__hpv.approvals()"), status: await js("__hpv.status()") });
	await js(`__hpv.cmd("trust-prototype")`);
	await waitFor(() => js("__hpv.modal()"), { what: "phone trust dialog again" });
	check("phone: trusting again asks for the checkbox again", await js("!!activeDocument.querySelector('.hpv-confirm-modal .hpv-ack input')"), null);
	await js(`__hpv.clickModal(${q(UI.cancel)})`);
	await waitFor(() => js("__hpv.modal() === null"), { what: "dialog closed" });

	// Without any approval, the phone does not even open the dialog.
	await js(`app.vault.adapter.write(".obsidian/plugins/${ID}/approvals.json", JSON.stringify({ version: 1, approvals: {} })).then(() => true)`);
	await js(`(document.querySelectorAll(".notice").forEach((n) => n.remove()), true)`);
	await js(`__hpv.cmd("trust-prototype")`);
	await sleep(1000);
	check("phone: without approval no dialog opens, a notice explains why", (await js("__hpv.modal()")) === null && (await js("__hpv.notices()")).includes(UI.needsApproval), await js("__hpv.notices()"));
	await phoneMode(false);
});

// --- Upstream settings never grant trust ----------------------------------------------------------

await attempt("upstream settings", async () => {
	await js(`app.vault.adapter.write(".obsidian/plugins/${ID}/data.json", JSON.stringify({ viewport: "full", autoReload: true, strictIsolation: false, embedHeight: 600 })).then(() => true)`);
	await js(`app.plugins.disablePlugin("${ID}").then(() => app.plugins.enablePlugin("${ID}")).then(() => true)`);
	await pluginLoaded();
	const settings = await js(`({ keys: Object.keys(app.plugins.plugins["${ID}"].settings), trusted: Object.keys(app.plugins.plugins["${ID}"].settings.trusted) })`);
	check("data.json with strictIsolation:false loads with no global switch and no trust", !settings.keys.includes("strictIsolation") && settings.trusted.length === 0, settings);
	await open("02-isolation.html");
	await waitFor(async () => (await frameTitle()).includes("GREEN"), { what: "02 isolated" });
	check("…and files still open isolated", true, null);
});

// --- Fast switching never shows an older file -----------------------------------------------------

await attempt("fast switching", async () => {
	await js(`__hpv.open("01-basic.html"); __hpv.open("04-external-resources.html"); __hpv.open("03-anchors.html").then(() => true)`);
	await sleep(2000);
	// Obsidian decides which of the concurrent opens wins; the plugin must show exactly that file, once.
	const expected = { "01-basic.html": "The HTML is shown", "04-external-resources.html": "tries to load", "03-anchors.html": "Anchor check" };
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
