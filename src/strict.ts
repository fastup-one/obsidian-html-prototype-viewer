/**
 * Isolation primitives for the strict fork. Pure: no dependency on `obsidian`.
 *
 * Isolated mode: the file's content is loaded through `srcdoc` into a sandbox
 * without `allow-same-origin` (opaque origin, no access to Obsidian), with a
 * no-network Content-Security-Policy injected before any of the file's content.
 * Trusted mode: exactly the upstream non-strict iframe.
 */

export type RenderMode = "isolated" | "trusted";

/** The sandbox the upstream plugin granted in every case; its non-strict mode added `allow-same-origin`. */
export const UPSTREAM_SANDBOX_FLAGS: readonly string[] = [
	"allow-scripts",
	"allow-forms",
	"allow-popups",
	"allow-popups-to-escape-sandbox",
	"allow-modals",
	"allow-downloads",
];

/**
 * `allow-forms` stays because without it the `submit` event never fires and
 * forms handled by scripts stop working; real submissions are blocked by the
 * CSP's `form-action 'none'`. Popups, modals and downloads are not granted.
 */
const ISOLATED_SANDBOX_FLAGS: readonly string[] = ["allow-scripts", "allow-forms"];

export function sandboxFlags(mode: RenderMode): string[] {
	return mode === "trusted" ? [...UPSTREAM_SANDBOX_FLAGS, "allow-same-origin"] : [...ISOLATED_SANDBOX_FLAGS];
}

/** `srcdoc` inherits the embedder's origin when combined with `allow-same-origin`: never allowed. */
export function assertSrcdocSafe(flags: readonly string[]): void {
	if (flags.includes("allow-same-origin")) {
		throw new Error("srcdoc must never be combined with allow-same-origin");
	}
}

/**
 * No network for isolated content. `'unsafe-eval'` adds no capability: the
 * content already runs arbitrary inline scripts; blocking it would only break
 * pages silently.
 */
export const ISOLATED_CSP =
	"default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; " +
	"img-src data: blob:; font-src data:; media-src data: blob:; form-action 'none'";

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${ISOLATED_CSP}">`;
/** Without it, `href="#anchor"` resolves against Obsidian's URL and navigates the frame away. */
const BASE_TAG = '<base href="about:srcdoc">';

/** Whitespace (BOM included), comments and `<?…>` bogus comments: content that cannot run before a doctype. */
const LEADING_TRIVIA_RE = /^(?:\s+|<!--[\s\S]*?-->|<\?[^>]*>)*/;
const DOCTYPE_RE = /^<!doctype\b[^>]*>/i;
const BASE_HREF_RE = /<base\b[^>]*\bhref\s*=/i;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

export interface PreparedSrcdoc {
	html: string;
	injectedBase: boolean;
}

/**
 * Injects the CSP (always) and `<base href="about:srcdoc">` (unless the file
 * declares its own `<base href>`) at one point, before any of the file's
 * content: right after a leading doctype, otherwise at the very start. Never
 * before the doctype, which would switch the page to quirks mode.
 */
export function prepareSrcdoc(html: string): PreparedSrcdoc {
	const source = html.charCodeAt(0) === 0xfeff ? html.slice(1) : html;
	// Always matches, possibly with an empty string.
	const trivia = (LEADING_TRIVIA_RE.exec(source) as RegExpExecArray)[0];
	const doctype = DOCTYPE_RE.exec(source.slice(trivia.length));
	const at = doctype ? trivia.length + doctype[0].length : 0;
	const injectedBase = !BASE_HREF_RE.test(source.replace(COMMENT_RE, ""));
	const injection = CSP_META + (injectedBase ? BASE_TAG : "");
	return { html: source.slice(0, at) + injection + source.slice(at), injectedBase };
}

// --- Analysis for the notices shown outside the frame -----------------------

export type UrlClass = "relative" | "remote" | "inline" | "ignored";

const IGNORED_SCHEMES = new Set(["mailto", "tel", "sms", "about", "javascript"]);

export function classifyUrl(raw: string): UrlClass {
	const url = raw.trim();
	if (!url || url.startsWith("#")) return "ignored";
	if (url.startsWith("//")) return "remote";
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase();
	if (!scheme) return "relative";
	if (scheme === "data" || scheme === "blob") return "inline";
	if (IGNORED_SCHEMES.has(scheme)) return "ignored";
	return "remote";
}

export function srcsetUrls(value: string): string[] {
	const v = value.trim();
	if (/^data:/i.test(v)) return [v];
	return v
		.split(",")
		.map((candidate) => candidate.trim().split(/\s+/)[0])
		.filter((url): url is string => !!url);
}

export function cssUrls(css: string): string[] {
	const urls: string[] = [];
	for (const m of css.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) urls.push(m[2]);
	for (const m of css.matchAll(/@import\s+(["'])(.*?)\1/gi)) urls.push(m[2]);
	return urls.filter((url) => url !== "");
}

export interface ScriptSignals {
	popups: boolean;
	modals: boolean;
	navigation: boolean;
	downloads: boolean;
}

/** Heuristic, static: obfuscated code is not detected (documented residual risk). No lookbehind (old WebKit). */
export function scanScript(code: string): ScriptSignals {
	return {
		popups: /\b(?:window|self|top|parent|globalThis)\s*\.\s*open\s*\(/.test(code),
		modals:
			/(?:^|[^\w$.])(?:alert|confirm|prompt)\s*\(/.test(code) ||
			/\b(?:window|self|globalThis)\s*\.\s*(?:alert|confirm|prompt)\s*\(/.test(code),
		navigation:
			/\blocation\s*(?:\.\s*href\s*)?=(?!=)/.test(code) ||
			/\blocation\s*\.\s*(?:assign|replace)\s*\(/.test(code),
		downloads: /\.\s*download\s*=(?!=)/.test(code),
	};
}

export interface IsolatedAnalysis {
	/** Neighbouring files the page references: they cannot load from an isolated frame. */
	relative: string[];
	/** Internet resources: blocked by the CSP. */
	remote: string[];
	popups: boolean;
	modals: boolean;
	downloads: boolean;
	/** Code or markup that can navigate the frame away (see the residual risks). */
	navigation: boolean;
}

const RESOURCE_ATTRS: ReadonlyArray<[selector: string, attr: string]> = [
	["script[src]", "src"],
	["img[src]", "src"],
	["input[type=image][src]", "src"],
	["source[src]", "src"],
	["video[src]", "src"],
	["video[poster]", "poster"],
	["audio[src]", "src"],
	["track[src]", "src"],
	["iframe[src]", "src"],
	["embed[src]", "src"],
	["object[data]", "data"],
];
const SRCSET_SELECTORS = ["img[srcset]", "source[srcset]"];
const RESOURCE_LINK_REL = /\b(?:stylesheet|icon|preload|modulepreload|prefetch|manifest|apple-touch-icon)\b/i;
const NEW_CONTEXT_TARGET = /^(?!_self$).+/i;

/**
 * Analyses an inert document (from `DOMParser`, never inserted into Obsidian's
 * DOM): nothing in it runs or loads.
 */
export function analyzeDocument(doc: Document): IsolatedAnalysis {
	const relative = new Set<string>();
	const remote = new Set<string>();
	const result = { popups: false, modals: false, downloads: false, navigation: false };

	const addResource = (url: string) => {
		const cls = classifyUrl(url);
		if (cls === "relative") relative.add(url.trim());
		else if (cls === "remote") remote.add(url.trim());
	};
	const addSignals = (code: string) => {
		const s = scanScript(code);
		result.popups ||= s.popups;
		result.modals ||= s.modals;
		result.navigation ||= s.navigation;
		result.downloads ||= s.downloads;
	};

	for (const [selector, attr] of RESOURCE_ATTRS) {
		doc.querySelectorAll(selector).forEach((el) => addResource(el.getAttribute(attr) ?? ""));
	}
	for (const selector of SRCSET_SELECTORS) {
		doc.querySelectorAll(selector).forEach((el) => srcsetUrls(el.getAttribute("srcset") ?? "").forEach(addResource));
	}
	doc.querySelectorAll("link[href]").forEach((el) => {
		if (RESOURCE_LINK_REL.test(el.getAttribute("rel") ?? "")) addResource(el.getAttribute("href") ?? "");
	});
	doc.querySelectorAll("style").forEach((el) => cssUrls(el.textContent ?? "").forEach(addResource));
	doc.querySelectorAll("[style]").forEach((el) => cssUrls(el.getAttribute("style") ?? "").forEach(addResource));

	doc.querySelectorAll("a[href], area[href]").forEach((el) => {
		const href = el.getAttribute("href") ?? "";
		const cls = classifyUrl(href);
		const opensElsewhere = NEW_CONTEXT_TARGET.test(el.getAttribute("target") ?? "");
		if (cls === "relative" && /\.html?(?:[?#].*)?$/i.test(href.trim())) relative.add(href.trim());
		if (cls === "remote" || cls === "relative") {
			if (opensElsewhere) result.popups = true;
			else if (cls === "remote") result.navigation = true;
		}
	});
	doc.querySelectorAll("[target]").forEach((el) => {
		if (el.tagName !== "A" && el.tagName !== "AREA" && NEW_CONTEXT_TARGET.test(el.getAttribute("target") ?? "")) {
			result.popups = true;
		}
	});
	doc.querySelectorAll("[download]").forEach(() => (result.downloads = true));
	doc.querySelectorAll("meta[http-equiv]").forEach((el) => {
		if ((el.getAttribute("http-equiv") ?? "").trim().toLowerCase() === "refresh") result.navigation = true;
	});

	doc.querySelectorAll("script:not([src])").forEach((el) => addSignals(el.textContent ?? ""));
	doc.querySelectorAll("*").forEach((el) => {
		for (const attr of Array.from(el.attributes)) {
			if (attr.name.toLowerCase().startsWith("on")) addSignals(attr.value);
		}
	});

	return { relative: [...relative], remote: [...remote], ...result };
}

// --- Review shown in the trust dialog -----------------------------------------

export interface HtmlReview {
	/** Reaches the surrounding window (parent, top, opener, frameElement): on mobile, the whole vault once trusted. */
	hostAccess: boolean;
	/** Calls Obsidian's own API or a module loader. */
	obsidianApi: boolean;
	/** Builds and runs code at runtime. */
	dynamicCode: boolean;
	/** Encoded or obfuscated content. */
	obfuscation: boolean;
	/** Stores data in the browser. */
	storage: boolean;
	/** Hosts the page refers to (any http(s) or protocol-relative URL), sorted. */
	remoteHosts: string[];
}

/**
 * Quick static review of an HTML file's text, to help decide whether to trust
 * it. Heuristic: hidden or generated code is not detected, so a clean review is
 * not a guarantee. No lookbehind (old WebKit).
 */
export function reviewHtml(html: string): HtmlReview {
	const hosts = new Set<string>();
	for (const m of html.matchAll(/(?:https?:)?\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)(?::\d+)?/gi)) {
		hosts.add(m[1].toLowerCase());
	}
	return {
		hostAccess:
			/\b(?:parent|top|opener)\s*\.\s*(?:document|app|location|post[M]essage|frames|window|require|localStorage|frameElement)\b/.test(html) ||
			/\bframeElement\b/.test(html) ||
			/\bwindow\s*\.\s*(?:parent|top|opener)\b/.test(html),
		obsidianApi:
			/\bapp\s*\.\s*(?:vault|workspace|plugins|metadataCache|fileManager|commands|setting)\b/.test(html) ||
			/\brequire\s*\(/.test(html),
		dynamicCode:
			/\beval\s*\(/.test(html) ||
			/\bnew\s+Function\b/.test(html) ||
			/\b(?:setTimeout|setInterval)\s*\(\s*["'`]/.test(html),
		obfuscation:
			/\batob\s*\(/.test(html) ||
			/\bunescape\s*\(/.test(html) ||
			/String\s*\.\s*fromCharCode\s*\((?:\s*\d+\s*,){20}/.test(html) ||
			/[A-Za-z0-9+/]{2000,}={0,2}/.test(html),
		storage: /\b(?:localStorage|sessionStorage|indexedDB)\b/.test(html),
		remoteHosts: [...hosts].sort(),
	};
}
