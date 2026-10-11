import { EventRef, Events, Notice, Plugin, TAbstractFile, TFile } from "obsidian";
import { ConfirmModal } from "./confirm-modal";
import { registerEmbed } from "./embed";
import { canOpenExternally, openExternally } from "./frame";
import { t } from "./i18n";
import { HtmlPrototypeSettingTab } from "./settings";
import { HtmlPrototypeSettings, normalizeSettings } from "./settings-model";
import { sha256Hex } from "./sha256";
import { TrustStore, emptyStore, removePath, renamePath, revoke, touchesPath, trust } from "./trust";
import { HtmlPrototypeView, VIEW_TYPE_HTML_PROTOTYPE } from "./view";

export default class HtmlPrototypeViewerPlugin extends Plugin {
	settings: HtmlPrototypeSettings = normalizeSettings(null);
	/** Emits "changed" with a path, or `null` for every file, after the trust list changes. */
	private readonly trustEvents = new Events();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_HTML_PROTOTYPE, (leaf) => new HtmlPrototypeView(leaf, this));
		this.registerExtensions(["html", "htm"], VIEW_TYPE_HTML_PROTOTYPE);

		registerEmbed(this);
		this.addSettingTab(new HtmlPrototypeSettingTab(this.app, this));

		this.addCommand({
			id: "reload-prototype",
			name: t("command.reload"),
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(HtmlPrototypeView);
				if (!view) return false;
				if (!checking) view.reload();
				return true;
			},
		});

		this.addCommand({
			id: "open-prototype-in-browser",
			name: t("command.openExternally"),
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(HtmlPrototypeView);
				if (!view?.file || !canOpenExternally(this.app)) return false;
				if (!checking) openExternally(this.app, view.file);
				return true;
			},
		});

		this.addCommand({
			id: "insert-prototype-embed",
			name: t("command.insertEmbed"),
			editorCallback: (editor) => {
				editor.replaceSelection(
					"```html-preview\npath: \nheight: " + this.settings.embedHeight + "\n```\n",
				);
			},
		});

		this.addCommand({
			id: "trust-prototype",
			name: t("command.trust"),
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(HtmlPrototypeView);
				if (!view?.file || view.decision === "trusted") return false;
				if (!checking) void this.requestTrust(view.file);
				return true;
			},
		});

		this.addCommand({
			id: "revoke-prototype-trust",
			name: t("command.revoke"),
			checkCallback: (checking: boolean) => {
				const view = this.app.workspace.getActiveViewOfType(HtmlPrototypeView);
				if (!view?.file || view.decision !== "trusted") return false;
				if (!checking) void this.revokeFile(view.file);
				return true;
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile)) return;
				if (file.extension !== "html" && file.extension !== "htm") return;
				if (!canOpenExternally(this.app)) return;
				menu.addItem((item) =>
					item
						.setTitle(t("action.openExternally"))
						.setIcon("external-link")
						.onClick(() => openExternally(this.app, file)),
				);
			}),
		);

		// Trust follows a file (or folder) when it is renamed or moved, and is dropped when it is deleted.
		this.registerEvent(
			this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				if (touchesPath(this.settings.trusted, oldPath)) {
					void this.updateTrust(renamePath(this.settings.trusted, oldPath, file.path), null);
				}
			}),
		);
		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				if (touchesPath(this.settings.trusted, file.path)) {
					void this.updateTrust(removePath(this.settings.trusted, file.path), null);
				}
			}),
		);
	}

	async loadSettings(): Promise<void> {
		// Everything read from data.json is validated; the upstream global
		// `strictIsolation` switch is dropped and never grants trust.
		this.settings = normalizeSettings(await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onTrustChanged(callback: (path: string | null) => void): EventRef {
		return this.trustEvents.on("changed", (path: unknown) => callback(typeof path === "string" ? path : null));
	}

	private async updateTrust(next: TrustStore, changedPath: string | null): Promise<void> {
		this.settings.trusted = next;
		await this.saveSettings();
		this.trustEvents.trigger("changed", changedPath);
	}

	/**
	 * Asks for confirmation, then trusts the content the operator was shown. The
	 * file is hashed again on confirmation: if it changed meanwhile, nothing is trusted.
	 */
	async requestTrust(file: TFile): Promise<void> {
		let shownHash: string;
		let size: number;
		try {
			const html = await this.app.vault.read(file);
			shownHash = sha256Hex(html);
			size = new TextEncoder().encode(html).length;
		} catch (error) {
			new Notice(t("trust.error", file.path, error instanceof Error ? error.message : String(error)));
			return;
		}

		new ConfirmModal(
			this.app,
			{
				title: t("trust.title"),
				confirmText: t("trust.confirm"),
				cancelText: t("trust.cancel"),
				body: (el) => {
					const facts = el.createEl("dl", { cls: "hpv-trust-facts" });
					facts.createEl("dt", { text: t("trust.file") });
					facts.createEl("dd", { text: file.path });
					facts.createEl("dt", { text: t("trust.size") });
					facts.createEl("dd", { text: formatSize(size) });
					facts.createEl("dt", { text: t("trust.hash") });
					facts.createEl("dd", { cls: "hpv-trust-hash", text: shownHash.slice(0, 12) });
					el.createEl("p", { text: t("trust.intro") });
					const list = el.createEl("ul");
					list.createEl("li", { text: t("trust.warning.scripts") });
					list.createEl("li", { text: t("trust.warning.network") });
					list.createEl("li", { text: t("trust.warning.storage") });
					list.createEl("li").createEl("strong", { text: t("trust.warning.mobile") });
					list.createEl("li", { text: t("trust.warning.changes") });
				},
			},
			() => void this.confirmTrust(file, shownHash),
		).open();
	}

	private async confirmTrust(file: TFile, shownHash: string): Promise<void> {
		try {
			const currentHash = sha256Hex(await this.app.vault.read(file));
			if (currentHash !== shownHash) {
				new Notice(t("trust.changedMeanwhile"));
				return;
			}
			await this.updateTrust(trust(this.settings.trusted, file.path, currentHash), file.path);
			new Notice(t("trust.done", file.basename));
		} catch (error) {
			new Notice(t("trust.error", file.path, error instanceof Error ? error.message : String(error)));
		}
	}

	/** Reducing privileges needs no confirmation. */
	async revokeFile(file: TFile): Promise<void> {
		await this.revokePath(file.path);
		new Notice(t("trust.revoked", file.basename));
	}

	async revokePath(path: string): Promise<void> {
		await this.updateTrust(revoke(this.settings.trusted, path), path);
	}

	async revokeAll(): Promise<void> {
		await this.updateTrust(emptyStore(), null);
	}
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
