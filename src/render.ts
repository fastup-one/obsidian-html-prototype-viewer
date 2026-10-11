import { TFile, setIcon } from "obsidian";
import type HtmlPrototypeViewerPlugin from "./main";
import { createFrame } from "./frame";
import { t } from "./i18n";
import { sha256Hex } from "./sha256";
import { IsolatedAnalysis, analyzeDocument } from "./strict";
import { TrustDecision, decideMode } from "./trust";

/** Where a render goes: notices outside the frame, and the frame itself. */
export interface RenderTarget {
	statusEl: HTMLElement;
	stageEl: HTMLElement;
}

export interface RenderOptions {
	/** Only meaningful for trusted files, which load from disk. */
	cacheBust?: boolean;
	/** Checked after every await: a newer render, a closed view or a removed block wins. */
	isCurrent: () => boolean;
	/** Offered when an isolated frame is stopped after leaving its document. */
	onReload: () => void;
}

export interface RenderResult {
	decision: TrustDecision;
	frame: HTMLIFrameElement;
}

/**
 * Single flow for tabs and embedded blocks: read → hash → decide → frame.
 * Never leaves a blank frame: a read error is explained instead.
 */
export async function renderFile(
	plugin: HtmlPrototypeViewerPlugin,
	file: TFile,
	target: RenderTarget,
	opts: RenderOptions,
): Promise<RenderResult | null> {
	let html: string;
	try {
		html = await plugin.app.vault.read(file);
	} catch (error) {
		if (!opts.isCurrent()) return null;
		target.statusEl.empty();
		target.stageEl.empty();
		target.stageEl.createDiv({
			cls: "hpv-error",
			text: t("notice.readError", file.path, error instanceof Error ? error.message : String(error)),
		});
		return null;
	}
	if (!opts.isCurrent()) return null;

	// Any failure while hashing or deciding falls back to isolation (invariant 4).
	let decision: TrustDecision = "isolated";
	try {
		decision = decideMode(file.path, sha256Hex(html), plugin.settings.trusted);
	} catch {
		decision = "isolated";
	}

	target.statusEl.empty();
	target.stageEl.empty();

	const frame =
		decision === "trusted"
			? createFrame(plugin.app, file, { mode: "trusted", cacheBust: opts.cacheBust })
			: createFrame(plugin.app, file, { mode: "isolated", html });

	if (decision === "trusted") {
		renderTrustedStatus(target.statusEl);
	} else {
		renderIsolatedStatus(target.statusEl, decision, analyze(html));
		watchNavigation(frame, target, opts.onReload);
	}
	target.stageEl.appendChild(frame);
	return { decision, frame };
}

/** The HTML is parsed into an inert document: nothing in it runs or loads, and it never reaches Obsidian's DOM. */
function analyze(html: string): IsolatedAnalysis | null {
	try {
		return analyzeDocument(new DOMParser().parseFromString(html, "text/html"));
	} catch {
		return null;
	}
}

/**
 * Invariant 9: an isolated frame fires `load` once for its own document. Any
 * further `load` means it left that document (navigation, refresh, reload):
 * the frame is removed and the reason shown. Best effort — see the residual
 * risks for navigations during the initial load.
 */
function watchNavigation(frame: HTMLIFrameElement, target: RenderTarget, onReload: () => void): void {
	let loads = 0;
	frame.addEventListener("load", () => {
		loads += 1;
		if (loads < 2) return;
		frame.remove();
		const notice = target.stageEl.createDiv({ cls: "hpv-error" });
		notice.createSpan({ text: t("notice.navigated") + " " });
		const button = notice.createEl("button", { text: t("notice.navigated.reload") });
		button.addEventListener("click", onReload);
	});
}

function badge(parent: HTMLElement, icon: string, text: string, cls: string): HTMLElement {
	const el = parent.createSpan({ cls: `hpv-badge ${cls}` });
	setIcon(el.createSpan({ cls: "hpv-badge-icon" }), icon);
	el.createSpan({ text });
	return el;
}

function renderTrustedStatus(statusEl: HTMLElement): void {
	const details = statusEl.createEl("details", { cls: "hpv-details" });
	badge(details.createEl("summary"), "shield-off", t("status.trusted"), "is-trusted");
	details.createDiv({ cls: "hpv-details-body", text: t("status.trusted.details") });
}

function renderIsolatedStatus(statusEl: HTMLElement, decision: TrustDecision, analysis: IsolatedAnalysis | null): void {
	const details = statusEl.createEl("details", { cls: "hpv-details" });
	badge(details.createEl("summary"), "shield", t("status.isolated"), "is-isolated");
	const body = details.createDiv({ cls: "hpv-details-body" });
	body.createEl("p", { text: t("status.isolated.blocked") });
	body.createEl("p", { text: t("status.isolated.residual") });
	body.createEl("p", { text: t("status.isolated.howto") });

	if (decision === "isolated-changed") {
		statusEl.createDiv({ cls: "hpv-notice is-warning", text: t("notice.changed") });
	}
	if (!analysis) return;

	listNotice(statusEl, t("notice.relative", String(analysis.relative.length)), analysis.relative);
	listNotice(statusEl, t("notice.remote", String(analysis.remote.length)), analysis.remote);

	const features: string[] = [];
	if (analysis.popups) features.push(t("feature.popups"));
	if (analysis.modals) features.push(t("feature.modals"));
	if (analysis.downloads) features.push(t("feature.downloads"));
	if (features.length > 0) {
		statusEl.createDiv({ cls: "hpv-notice", text: t("notice.features", features.join(", ")) });
	}
	if (analysis.navigation) {
		statusEl.createDiv({ cls: "hpv-notice", text: t("notice.navigationCode") });
	}
}

function listNotice(statusEl: HTMLElement, title: string, items: string[]): void {
	if (items.length === 0) return;
	const details = statusEl.createEl("details", { cls: "hpv-notice hpv-details" });
	details.createEl("summary", { text: title });
	const list = details.createEl("ul");
	for (const item of items) list.createEl("li", { text: item });
}
