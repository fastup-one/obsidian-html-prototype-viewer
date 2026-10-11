import { FileView, Menu, TAbstractFile, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type HtmlPrototypeViewerPlugin from "./main";
import { canOpenExternally, openExternally } from "./frame";
import { t } from "./i18n";
import { renderFile } from "./render";
import { VIEWPORTS, ViewportId, viewportById } from "./settings-model";
import { TrustDecision } from "./trust";

export const VIEW_TYPE_HTML_PROTOTYPE = "html-prototype-view";

export class HtmlPrototypeView extends FileView {
	private plugin: HtmlPrototypeViewerPlugin;
	private statusEl: HTMLElement | null = null;
	private stageEl: HTMLElement | null = null;
	private frameEl: HTMLIFrameElement | null = null;
	private trustActionEl: HTMLElement | null = null;
	private viewport: ViewportId;
	/** Bumped by every render: an older render that resumes after an await is discarded. */
	private generation = 0;
	/** How the current file is shown; `null` while nothing is rendered. */
	decision: TrustDecision | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: HtmlPrototypeViewerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.viewport = plugin.settings.viewport;
		this.navigation = true;
	}

	getViewType(): string {
		return VIEW_TYPE_HTML_PROTOTYPE;
	}

	getIcon(): string {
		return "layout-template";
	}

	getDisplayText(): string {
		return this.file ? this.file.basename : t("view.title");
	}

	canAcceptExtension(extension: string): boolean {
		return extension === "html" || extension === "htm";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("hpv-view");
		this.statusEl = this.contentEl.createDiv({ cls: "hpv-status" });
		this.stageEl = this.contentEl.createDiv({ cls: "hpv-stage" });

		this.addAction("refresh-cw", t("action.reload"), () => this.reload());
		this.addAction("monitor-smartphone", t("action.viewport"), (evt) => this.showViewportMenu(evt));
		if (canOpenExternally(this.app)) {
			this.addAction("external-link", t("action.openExternally"), () => {
				if (this.file) openExternally(this.app, this.file);
			});
		}
		this.trustActionEl = this.addAction("shield", t("action.trust"), () => this.toggleTrust());
		this.updateTrustAction();

		// Registered once for the lifetime of the view: `this.file` changes as the
		// user navigates, so the comparison is made at call time instead.
		this.registerEvent(
			this.app.vault.on("modify", (changed: TAbstractFile) => {
				if (!this.file || changed.path !== this.file.path) return;
				// A trusted file is always re-evaluated: new content must not keep the old trust.
				if (this.decision === "trusted" || this.plugin.settings.autoReload) this.reload();
			}),
		);
		this.registerEvent(
			this.plugin.onTrustChanged((path) => {
				if (this.file && (path === null || path === this.file.path)) this.reload();
			}),
		);
	}

	async onLoadFile(file: TFile): Promise<void> {
		await this.render(file);
	}

	async onUnloadFile(): Promise<void> {
		this.generation += 1;
		this.frameEl = null;
		this.decision = null;
		this.statusEl?.empty();
		this.stageEl?.empty();
		this.updateTrustAction();
	}

	async onClose(): Promise<void> {
		this.generation += 1;
		this.frameEl = null;
		this.contentEl.empty();
	}

	private async render(file: TFile, cacheBust = false): Promise<void> {
		if (!this.statusEl || !this.stageEl) return;
		const generation = ++this.generation;
		const isCurrent = () => generation === this.generation && this.file === file;
		const result = await renderFile(
			this.plugin,
			file,
			{ statusEl: this.statusEl, stageEl: this.stageEl },
			{ cacheBust, isCurrent, onReload: () => this.reload() },
		);
		if (!isCurrent()) return;
		this.frameEl = result?.frame ?? null;
		this.decision = result?.decision ?? null;
		this.applyViewport();
		this.updateTrustAction();
	}

	reload(): void {
		if (this.file) void this.render(this.file, true);
	}

	private toggleTrust(): void {
		if (!this.file) return;
		if (this.decision === "trusted") void this.plugin.revokeFile(this.file);
		else void this.plugin.requestTrust(this.file);
	}

	private updateTrustAction(): void {
		const el = this.trustActionEl;
		if (!el) return;
		const trusted = this.decision === "trusted";
		setIcon(el, trusted ? "shield-off" : "shield");
		el.setAttribute(
			"aria-label",
			t(trusted ? "action.revoke" : this.plugin.requiresApproval ? "action.trust.mobile" : "action.trust"),
		);
		el.toggleClass("hpv-trust-action-trusted", trusted);
	}

	private applyViewport(): void {
		const vp = viewportById(this.viewport);
		this.stageEl?.toggleClass("is-constrained", vp.width !== null);
		if (vp.width !== null) {
			this.frameEl?.style.setProperty("--hpv-frame-width", `${vp.width}px`);
		} else {
			this.frameEl?.style.removeProperty("--hpv-frame-width");
		}
	}

	private showViewportMenu(evt: MouseEvent): void {
		const menu = new Menu();
		for (const vp of VIEWPORTS) {
			menu.addItem((item) =>
				item
					.setTitle(t(vp.labelKey))
					.setChecked(vp.id === this.viewport)
					.onClick(() => {
						this.viewport = vp.id;
						this.applyViewport();
					}),
			);
		}
		menu.showAtMouseEvent(evt);
	}
}
