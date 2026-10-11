import { MarkdownPostProcessorContext, MarkdownRenderChild, TAbstractFile, TFile } from "obsidian";
import type HtmlPrototypeViewerPlugin from "./main";
import { canOpenExternally, openExternally } from "./frame";
import { t } from "./i18n";
import { renderFile } from "./render";
import { TrustDecision } from "./trust";

export const EMBED_LANG = "html-preview";

interface EmbedSpec {
	target: string;
	height: number | null;
	width: number | null;
}

/**
 * Accepts, in any order:
 *   - a bare line holding the path or a `[[link]]`
 *   - `path: <path>`, `height: <px>`, `width: <px>`
 */
function parseSpec(source: string): EmbedSpec {
	const spec: EmbedSpec = { target: "", height: null, width: null };

	for (const rawLine of source.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const match = /^(path|file|height|width)\s*:\s*(.+)$/i.exec(line);
		if (!match) {
			if (!spec.target) spec.target = line;
			continue;
		}

		const key = match[1].toLowerCase();
		const value = match[2].trim();
		if (key === "path" || key === "file") {
			spec.target = value;
		} else {
			const parsed = Number.parseInt(value, 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				if (key === "height") spec.height = parsed;
				else spec.width = parsed;
			}
		}
	}

	spec.target = spec.target.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
	return spec;
}

function renderError(el: HTMLElement, message: string): void {
	el.createDiv({ cls: "hpv-embed-error", text: message });
}

/**
 * Lifetime of one embedded block: its listeners are removed and any pending
 * render is discarded when the block leaves the note.
 */
class EmbedChild extends MarkdownRenderChild {
	generation = 0;
	unloaded = false;
	decision: TrustDecision | null = null;

	onunload(): void {
		this.unloaded = true;
	}
}

export function registerEmbed(plugin: HtmlPrototypeViewerPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		EMBED_LANG,
		async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const spec = parseSpec(source);
			if (!spec.target) {
				renderError(el, t("embed.error.noTarget"));
				return;
			}

			const dest = plugin.app.metadataCache.getFirstLinkpathDest(spec.target, ctx.sourcePath);
			if (!(dest instanceof TFile)) {
				renderError(el, t("embed.error.notFound", spec.target));
				return;
			}
			if (dest.extension !== "html" && dest.extension !== "htm") {
				renderError(el, t("embed.error.notHtml", dest.name));
				return;
			}

			const wrapper = el.createDiv({ cls: "hpv-embed" });

			const bar = wrapper.createDiv({ cls: "hpv-embed-bar" });
			bar.createSpan({ cls: "hpv-embed-title", text: dest.basename });
			const actions = bar.createDiv({ cls: "hpv-embed-actions" });

			if (canOpenExternally(plugin.app)) {
				const openBtn = actions.createEl("button", {
					cls: "hpv-embed-btn",
					text: t("embed.button.browser"),
				});
				openBtn.addEventListener("click", () => openExternally(plugin.app, dest));
			}

			const tabBtn = actions.createEl("button", {
				cls: "hpv-embed-btn",
				text: t("embed.button.tab"),
			});
			tabBtn.addEventListener("click", () => {
				void plugin.app.workspace.getLeaf("tab").openFile(dest);
			});

			const statusEl = wrapper.createDiv({ cls: "hpv-status hpv-embed-status" });
			const stage = wrapper.createDiv({ cls: "hpv-embed-stage" });

			const child = new EmbedChild(wrapper);
			ctx.addChild(child);

			const render = async (cacheBust: boolean): Promise<void> => {
				const generation = ++child.generation;
				const isCurrent = () => !child.unloaded && generation === child.generation;
				const result = await renderFile(
					plugin,
					dest,
					{ statusEl, stageEl: stage },
					{ cacheBust, isCurrent, onReload: () => void render(true) },
				);
				if (!result || !isCurrent()) return;
				child.decision = result.decision;
				result.frame.style.setProperty("--hpv-frame-height", `${spec.height ?? plugin.settings.embedHeight}px`);
				if (spec.width !== null) {
					result.frame.style.setProperty("--hpv-frame-width", `${spec.width}px`);
				}
			};

			child.registerEvent(
				plugin.app.vault.on("modify", (changed: TAbstractFile) => {
					if (changed.path !== dest.path) return;
					// A trusted file is always re-evaluated: new content must not keep the old trust.
					if (child.decision === "trusted" || plugin.settings.autoReload) void render(true);
				}),
			);
			child.registerEvent(
				plugin.onTrustChanged((path) => {
					if (path === null || path === dest.path) void render(false);
				}),
			);

			await render(false);
		},
	);
}
