/**
 * Find in page for isolated documents. Pure: no dependency on `obsidian`.
 *
 * The parent cannot search an isolated frame (opaque origin: its document is out
 * of reach, by design), so the search runs inside it: `findInPage` is
 * serialised with `toString()` and injected right after the CSP. It runs as
 * part of the page, with exactly the page's privileges, and adds none. It must
 * stay self-contained: no imports, nothing from outside its own body.
 *
 * It opens with Ctrl/Cmd+F inside the page, or when the plugin posts the fixed
 * FIND_MESSAGE (header button, Ctrl/Cmd+F on the view). Nothing is ever sent
 * back, and the plugin listens to no message from any frame.
 */

/** The only message the plugin ever posts to a frame, and only to an isolated one. */
export const FIND_MESSAGE = "hpv-strict:find";

export interface FindStrings {
	placeholder: string;
	previous: string;
	next: string;
	close: string;
	noResults: string;
}

/** The `<script>` element injected into isolated documents. */
export function findScript(strings: FindStrings): string {
	// `<` escaped: no string can close the script element or open a comment in it.
	const args = [FIND_MESSAGE, strings].map((value) => JSON.stringify(value).replace(/</g, "\\u003c")).join(", ");
	return `<script>(${findInPage.toString()})(${args});</script>`;
}

/**
 * Runs inside the isolated frame. Case- and accent-insensitive search of the
 * visible text; matches are painted with the CSS Custom Highlight API, so the
 * page's DOM is never modified (only the bar's own host element is added, the
 * first time it opens).
 */
export function findInPage(message: string, S: FindStrings): void {
	const win = window;
	const doc = document;
	const MAX = 2000;
	const SKIP = new Set(["script", "style", "noscript", "template", "textarea"]);
	const canHighlight = typeof Highlight === "function" && typeof CSS !== "undefined" && "highlights" in CSS;

	let host: HTMLElement | null = null;
	let input: HTMLInputElement | null = null;
	let counter: HTMLElement | null = null;
	let ranges: Range[] = [];
	let capped = false;
	let current = -1;
	let isOpen = false;
	let stale = false;
	let typingTimer = 0;
	let refreshTimer = 0;
	let observer: MutationObserver | null = null;
	let docStyled = false;

	const fold = (s: string): string =>
		s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

	function isVisible(el: Element, cache: Map<Element, boolean>): boolean {
		let visible = cache.get(el);
		if (visible === undefined) {
			visible =
				typeof el.checkVisibility === "function"
					? el.checkVisibility({ checkVisibilityCSS: true })
					: el.getClientRects().length > 0;
			cache.set(el, visible);
		}
		return visible;
	}

	/** Folds the visible text into one string, mapping each folded character back to its node and offset. */
	function search(query: string): void {
		ranges = [];
		capped = false;
		const q = fold(query).replace(/\s+/g, " ").trim();
		if (!q) return;
		const nodes: Text[] = [];
		const nodeAt: number[] = [];
		const offsetAt: number[] = [];
		let text = "";
		const cache = new Map<Element, boolean>();
		const walker = doc.createTreeWalker(doc.body ?? doc.documentElement, NodeFilter.SHOW_TEXT);
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const node = n as Text;
			const parent = node.parentElement;
			if (!parent || parent === host || SKIP.has(parent.localName) || !isVisible(parent, cache)) continue;
			const index = nodes.push(node) - 1;
			const data = node.data;
			for (let i = 0; i < data.length; i++) {
				const ch = data[i];
				if (/\s/.test(ch)) {
					if (text.length === 0 || text[text.length - 1] === " ") continue;
					text += " ";
					nodeAt.push(index);
					offsetAt.push(i);
					continue;
				}
				const folded = ch.charCodeAt(0) < 128 ? ch.toLowerCase() : fold(ch);
				for (let k = 0; k < folded.length; k++) {
					text += folded[k];
					nodeAt.push(index);
					offsetAt.push(i);
				}
			}
		}
		let from = 0;
		for (;;) {
			const at = text.indexOf(q, from);
			if (at < 0) break;
			if (ranges.length === MAX) {
				capped = true;
				break;
			}
			const end = at + q.length - 1;
			const range = doc.createRange();
			range.setStart(nodes[nodeAt[at]], offsetAt[at]);
			range.setEnd(nodes[nodeAt[end]], offsetAt[end] + 1);
			ranges.push(range);
			from = at + q.length;
		}
	}

	function paint(): void {
		if (canHighlight) {
			// A maplike registry (its Map methods live in lib "DOM.Iterable", not enabled here).
			const registry = CSS.highlights as unknown as Map<string, Highlight>;
			if (ranges.length > 0) registry.set("hpv-find", new Highlight(...ranges));
			else registry.delete("hpv-find");
			if (current >= 0 && current < ranges.length) {
				const mark = new Highlight(ranges[current]);
				mark.priority = 1;
				registry.set("hpv-find-current", mark);
			} else {
				registry.delete("hpv-find-current");
			}
		}
		if (counter && input) {
			counter.textContent =
				ranges.length > 0
					? `${current + 1}/${ranges.length}${capped ? "+" : ""}`
					: input.value.trim()
						? S.noResults
						: "";
		}
	}

	function reveal(range: Range): void {
		const el = range.startContainer.parentElement;
		if (el) el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
		const rect = range.getBoundingClientRect();
		const h = win.innerHeight;
		// Kept clear of the bar at the top.
		if (rect.top < 56 || rect.bottom > h - 8) win.scrollBy({ top: rect.top - h / 3, behavior: "instant" });
		if (!canHighlight) {
			const selection = win.getSelection();
			if (selection) {
				selection.removeAllRanges();
				selection.addRange(range);
			}
		}
	}

	/** New query: start from the first match in or below the visible area, like a browser. */
	function runSearch(): void {
		typingTimer = 0;
		if (!input) return;
		search(input.value);
		stale = false;
		current = -1;
		for (let i = 0; i < ranges.length && current < 0; i++) {
			const rect = ranges[i].getBoundingClientRect();
			if (rect.bottom >= 0 && (rect.width > 0 || rect.height > 0)) current = i;
		}
		if (current < 0 && ranges.length > 0) current = 0;
		paint();
		if (current >= 0) reveal(ranges[current]);
	}

	/** The page changed (a language switch, a section opened): same query, same position when possible. */
	function refresh(): void {
		refreshTimer = 0;
		if (!input || !isOpen) return;
		const keep = current;
		search(input.value);
		stale = false;
		current = ranges.length > 0 ? Math.min(Math.max(keep, 0), ranges.length - 1) : -1;
		paint();
	}

	function go(step: number): void {
		if (typingTimer) {
			win.clearTimeout(typingTimer);
			runSearch();
			return;
		}
		if (stale) refresh();
		if (ranges.length === 0) {
			paint();
			return;
		}
		current = (current + step + ranges.length) % ranges.length;
		paint();
		reveal(ranges[current]);
	}

	function styleDocument(): void {
		if (docStyled || !canHighlight) return;
		docStyled = true;
		const css =
			"::highlight(hpv-find){background-color:#ffe066;color:#111}" +
			"::highlight(hpv-find-current){background-color:#ff9632;color:#111}";
		try {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(css);
			doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
		} catch {
			const style = doc.createElement("style");
			style.textContent = css;
			(doc.head ?? doc.documentElement).appendChild(style);
		}
	}

	function button(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
		const b = doc.createElement("button");
		b.type = "button";
		b.textContent = glyph;
		b.title = label;
		b.setAttribute("aria-label", label);
		b.addEventListener("click", onClick);
		return b;
	}

	function build(): void {
		const el = doc.createElement("hpv-find");
		// Inline and !important: the page's own CSS must not hide or move the bar.
		const fixed: Array<[string, string]> = [
			["all", "initial"],
			["position", "fixed"],
			["top", "8px"],
			["right", "8px"],
			["z-index", "2147483647"],
			["display", "none"],
		];
		for (const [property, value] of fixed) el.style.setProperty(property, value, "important");
		const root = el.attachShadow({ mode: "open" });
		const css =
			".bar{display:flex;align-items:center;gap:4px;box-sizing:border-box;width:min(340px,calc(100vw - 16px));" +
			"padding:5px 6px;border:1px solid #c8c8cc;border-radius:8px;background:#fff;color:#1d1d1f;" +
			"font:13px/1.2 system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.18)}" +
			"input{flex:1;min-width:0;margin:0;padding:4px 6px;border:1px solid #c8c8cc;border-radius:5px;" +
			"background:#fff;color:inherit;font:inherit;outline:none}" +
			"input:focus{border-color:#4a90e2}" +
			"@media (pointer:coarse){input{font-size:16px}}" +
			".count{min-width:3.2em;text-align:right;color:#6e6e73;font-variant-numeric:tabular-nums;white-space:nowrap}" +
			"button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;margin:0;padding:0;" +
			"border:0;border-radius:5px;background:transparent;color:inherit;font:inherit;font-size:14px;cursor:pointer}" +
			"button:hover{background:rgba(0,0,0,.08)}" +
			"@media (prefers-color-scheme:dark){.bar{background:#2c2c2e;color:#f2f2f7;border-color:#48484a}" +
			"input{background:#1c1c1e;border-color:#48484a}.count{color:#aeaeb2}button:hover{background:rgba(255,255,255,.12)}}";
		try {
			const sheet = new CSSStyleSheet();
			sheet.replaceSync(css);
			root.adoptedStyleSheets = [sheet];
		} catch {
			const style = doc.createElement("style");
			style.textContent = css;
			root.appendChild(style);
		}
		const bar = doc.createElement("div");
		bar.className = "bar";
		bar.setAttribute("role", "search");
		const field = doc.createElement("input");
		field.type = "text";
		field.placeholder = S.placeholder;
		field.setAttribute("aria-label", S.placeholder);
		field.setAttribute("autocomplete", "off");
		field.setAttribute("enterkeyhint", "search");
		field.spellcheck = false;
		field.addEventListener("input", () => {
			if (typingTimer) win.clearTimeout(typingTimer);
			typingTimer = win.setTimeout(runSearch, 150);
		});
		field.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				go(e.shiftKey ? -1 : 1);
			} else if (e.key === "Escape") {
				e.preventDefault();
				hide();
			}
		});
		const count = doc.createElement("span");
		count.className = "count";
		count.setAttribute("aria-live", "polite");
		bar.append(
			field,
			count,
			button(S.previous, "↑", () => go(-1)),
			button(S.next, "↓", () => go(1)),
			button(S.close, "✕", hide),
		);
		root.appendChild(bar);
		host = el;
		input = field;
		counter = count;
	}

	function watch(): void {
		if (observer || typeof MutationObserver !== "function") return;
		observer = new MutationObserver((records) => {
			if (records.every((r) => r.target === host)) return;
			stale = true;
			if (!refreshTimer) refreshTimer = win.setTimeout(refresh, 250);
		});
		observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true });
	}

	function show(): void {
		if (!host) build();
		if (!host || !input) return;
		// Appended to <html>, outside <body>: a page that rewrites its body keeps the bar.
		if (!host.isConnected) doc.documentElement.appendChild(host);
		styleDocument();
		host.style.setProperty("display", "block", "important");
		isOpen = true;
		watch();
		input.focus();
		input.select();
		if (input.value.trim()) runSearch();
	}

	function hide(): void {
		isOpen = false;
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		if (typingTimer) win.clearTimeout(typingTimer);
		if (refreshTimer) win.clearTimeout(refreshTimer);
		typingTimer = 0;
		refreshTimer = 0;
		host?.style.setProperty("display", "none", "important");
		ranges = [];
		current = -1;
		paint();
	}

	win.addEventListener(
		"keydown",
		(e) => {
			const mod = e.ctrlKey || e.metaKey;
			const key = (e.key || "").toLowerCase();
			if (mod && !e.altKey && !e.shiftKey && (key === "f" || e.code === "KeyF")) {
				e.preventDefault();
				e.stopPropagation();
				show();
			} else if (isOpen && (key === "f3" || (mod && !e.altKey && (key === "g" || e.code === "KeyG")))) {
				e.preventDefault();
				go(e.shiftKey ? -1 : 1);
			}
		},
		true,
	);
	win.addEventListener("message", (e) => {
		if (e.source === win.parent && e.data === message) show();
	});
}
