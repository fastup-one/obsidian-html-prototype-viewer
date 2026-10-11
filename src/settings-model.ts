/**
 * Settings data and its validation. Pure: no runtime dependency on `obsidian`.
 */
import type { TranslationKey } from "./i18n";
import { TrustStore, emptyStore, sanitizeStore } from "./trust";

export type ViewportId = "full" | "desktop" | "tablet" | "mobile";

export interface Viewport {
	id: ViewportId;
	labelKey: TranslationKey;
	/** Width forced onto the iframe, in px. `null` means the full panel width. */
	width: number | null;
}

export const VIEWPORTS: Viewport[] = [
	{ id: "full", labelKey: "viewport.full", width: null },
	{ id: "desktop", labelKey: "viewport.desktop", width: 1280 },
	{ id: "tablet", labelKey: "viewport.tablet", width: 834 },
	{ id: "mobile", labelKey: "viewport.mobile", width: 390 },
];

export function viewportById(id: ViewportId): Viewport {
	return VIEWPORTS.find((v) => v.id === id) ?? VIEWPORTS[0];
}

export interface HtmlPrototypeSettings {
	/** Render width applied when a prototype is opened. */
	viewport: ViewportId;
	/** Reloads the iframe whenever the file changes on disk. */
	autoReload: boolean;
	/** Default height, in px, of `html-preview` blocks inside notes. */
	embedHeight: number;
	/**
	 * Files the operator explicitly trusted, bound to the hash of their content.
	 * There is deliberately no global switch to turn isolation off.
	 */
	trusted: TrustStore;
}

export const DEFAULT_SETTINGS: Readonly<Omit<HtmlPrototypeSettings, "trusted">> = {
	viewport: "full",
	autoReload: true,
	embedHeight: 600,
};

/**
 * Builds valid settings from whatever `data.json` holds. Unknown keys are
 * dropped — notably the upstream `strictIsolation` switch, which never grants
 * trust here. Never throws.
 */
export function normalizeSettings(raw: unknown): HtmlPrototypeSettings {
	const data = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const viewport = VIEWPORTS.some((v) => v.id === data.viewport) ? (data.viewport as ViewportId) : DEFAULT_SETTINGS.viewport;
	const autoReload = typeof data.autoReload === "boolean" ? data.autoReload : DEFAULT_SETTINGS.autoReload;
	const embedHeight =
		typeof data.embedHeight === "number" && Number.isInteger(data.embedHeight) && data.embedHeight > 0
			? data.embedHeight
			: DEFAULT_SETTINGS.embedHeight;
	const trusted = data.trusted === undefined ? emptyStore() : sanitizeStore(data.trusted);
	return { viewport, autoReload, embedHeight, trusted };
}
