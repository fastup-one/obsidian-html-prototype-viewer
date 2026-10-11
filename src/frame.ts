import { App, TFile } from "obsidian";
import { RenderMode, assertSrcdocSafe, prepareSrcdoc, sandboxFlags } from "./strict";

/**
 * Obsidian's internal URL for a vault file: `app://<hash>/<path>?<mtime>` on
 * desktop, `capacitor://` on mobile. The hash is regenerated on every startup —
 * which is why an `app://local/...` path hand-written into a note does not
 * resolve, while this one works everywhere.
 */
export function resourceUrl(app: App, file: TFile): string {
	return app.vault.getResourcePath(file);
}

export type FrameSource =
	/** The file's content, already read: loaded through `srcdoc`. */
	| { mode: "isolated"; html: string }
	/** Loaded from disk through `src`, exactly like the upstream non-strict mode. */
	| { mode: "trusted"; cacheBust?: boolean };

export function createFrame(app: App, file: TFile, source: FrameSource): HTMLIFrameElement {
	const mode: RenderMode = source.mode;
	const flags = sandboxFlags(mode);
	const frame = createEl("iframe", { cls: "hpv-frame" });
	// Invariant 2: the sandbox is fixed before any content source is set and before
	// the frame reaches the DOM, and never changed afterwards: every render creates
	// a new frame.
	frame.setAttribute("sandbox", flags.join(" "));
	frame.setAttribute("referrerpolicy", "no-referrer");
	frame.setAttribute("title", file.basename);

	if (source.mode === "isolated") {
		// Invariants 1 and 3: `srcdoc` only ever goes into a sandbox without
		// `allow-same-origin` (it would inherit Obsidian's origin otherwise).
		assertSrcdocSafe(flags);
		frame.srcdoc = prepareSrcdoc(source.html).html;
	} else {
		// `src` on purpose: the trusted frame gets the file's own `app://` origin,
		// never Obsidian's.
		let url = resourceUrl(app, file);
		if (source.cacheBust) {
			url += (url.includes("?") ? "&" : "?") + "hpv=" + Date.now();
		}
		frame.src = url;
	}
	return frame;
}

/**
 * `openWithDefaultApp` is not part of `obsidian.d.ts`, so it is never called
 * blindly: the entry points relying on it are hidden when it is missing, rather
 * than failing silently.
 */
type MaybeOpener = { openWithDefaultApp?: (path: string) => unknown };

export function canOpenExternally(app: App): boolean {
	return typeof (app as unknown as MaybeOpener).openWithDefaultApp === "function";
}

/** Opens the file in the system's default application (the browser). */
export function openExternally(app: App, file: TFile): void {
	const opener = (app as unknown as MaybeOpener).openWithDefaultApp;
	if (typeof opener === "function") opener.call(app, file.path);
}
