import { App, PluginSettingTab, SettingDefinitionItem, TFile, moment } from "obsidian";
import type HtmlPrototypeViewerPlugin from "./main";
import { ConfirmModal } from "./confirm-modal";
import { TranslationKey, t } from "./i18n";
import { DEFAULT_SETTINGS, VIEWPORTS } from "./settings-model";
import { sha256Hex } from "./sha256";
import { getEntry } from "./trust";

type TrustStatus = "valid" | "changed" | "missing";

const STATUS_KEY: Record<TrustStatus, TranslationKey> = {
	valid: "setting.trusted.status.valid",
	changed: "setting.trusted.status.changed",
	missing: "setting.trusted.status.missing",
};

/** In Obsidian's language (moment's locale), not the system's. */
function formatDate(iso: string): string {
	return new Date(iso).toLocaleString(moment.locale(), { dateStyle: "medium", timeStyle: "short" });
}

function viewportOptions(): Record<string, string> {
	return Object.fromEntries(VIEWPORTS.map((vp) => [vp.id, t(vp.labelKey)]));
}

export class HtmlPrototypeSettingTab extends PluginSettingTab {
	private plugin: HtmlPrototypeViewerPlugin;
	/** Status of each trusted file, keyed by path, approved hash and mtime, so stale results are recomputed. */
	private statusCache = new Map<string, TrustStatus>();
	private checking = false;

	constructor(app: App, plugin: HtmlPrototypeViewerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		plugin.registerEvent(plugin.onTrustChanged(() => this.update()));
	}

	/**
	 * Declarative settings (Obsidian 1.13+). `getControlValue` / `setControlValue`
	 * default to reading and persisting `plugin.settings`, whose keys match the
	 * `key` fields below. There is deliberately no setting that disables isolation.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		const paths = Object.keys(this.plugin.settings.trusted).sort();
		if (paths.some((path) => !this.statusCache.has(this.cacheKey(path)))) void this.checkStatuses(paths);

		return [
			{
				name: t("setting.viewport.name"),
				desc: t("setting.viewport.desc"),
				control: {
					type: "dropdown",
					key: "viewport",
					options: viewportOptions(),
					defaultValue: DEFAULT_SETTINGS.viewport,
				},
			},
			{
				name: t("setting.autoReload.name"),
				desc: t("setting.autoReload.desc"),
				control: {
					type: "toggle",
					key: "autoReload",
					defaultValue: DEFAULT_SETTINGS.autoReload,
				},
			},
			{
				name: t("setting.embedHeight.name"),
				desc: t("setting.embedHeight.desc"),
				control: {
					type: "number",
					key: "embedHeight",
					defaultValue: DEFAULT_SETTINGS.embedHeight,
					placeholder: String(DEFAULT_SETTINGS.embedHeight),
					min: 1,
					step: 1,
				},
			},
			{
				name: t("setting.isolation.name"),
				desc: t("setting.isolation.desc"),
			},
			{
				type: "list",
				heading: t("setting.trusted.heading"),
				emptyState: t("setting.trusted.empty"),
				items: paths.map((path) => ({ name: path, desc: this.describe(path) })),
				// Revoking reduces privileges: no confirmation.
				onDelete: (index: number) => {
					const path = paths[index];
					if (path !== undefined) void this.plugin.revokePath(path);
				},
			},
			{
				name: t("setting.trusted.revokeAll.name"),
				desc: t("setting.trusted.revokeAll.desc"),
				visible: () => Object.keys(this.plugin.settings.trusted).length > 0,
				action: () => this.confirmRevokeAll(),
			},
		];
	}

	private describe(path: string): string {
		const entry = getEntry(this.plugin.settings.trusted, path);
		if (!entry) return "";
		const status = this.statusCache.get(this.cacheKey(path));
		return t(
			"setting.trusted.item",
			formatDate(entry.trustedAt),
			entry.sha256.slice(0, 12),
			t(status ? STATUS_KEY[status] : "setting.trusted.status.checking"),
		);
	}

	private cacheKey(path: string): string {
		const entry = getEntry(this.plugin.settings.trusted, path);
		const file = this.app.vault.getAbstractFileByPath(path);
		const mtime = file instanceof TFile ? String(file.stat.mtime) : "missing";
		return `${path}\n${entry?.sha256 ?? ""}\n${mtime}`;
	}

	private async checkStatuses(paths: string[]): Promise<void> {
		if (this.checking) return;
		this.checking = true;
		try {
			for (const path of paths) {
				const key = this.cacheKey(path);
				if (this.statusCache.has(key)) continue;
				const entry = getEntry(this.plugin.settings.trusted, path);
				const file = this.app.vault.getAbstractFileByPath(path);
				let status: TrustStatus = "missing";
				if (entry && file instanceof TFile) {
					try {
						status = sha256Hex(await this.app.vault.read(file)) === entry.sha256 ? "valid" : "changed";
					} catch {
						status = "missing";
					}
				}
				this.statusCache.set(key, status);
			}
		} finally {
			this.checking = false;
		}
		this.update();
	}

	private confirmRevokeAll(): void {
		const count = Object.keys(this.plugin.settings.trusted).length;
		if (count === 0) return;
		new ConfirmModal(
			this.app,
			{
				title: t("setting.trusted.revokeAll.title"),
				confirmText: t("setting.trusted.revokeAll.confirm"),
				cancelText: t("trust.cancel"),
				body: (el) => {
					el.createEl("p", { text: t("setting.trusted.revokeAll.body", String(count)) });
				},
			},
			() => void this.plugin.revokeAll(),
		).open();
	}
}
