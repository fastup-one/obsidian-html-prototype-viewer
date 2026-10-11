/**
 * Per-file trust exceptions. Pure: no dependency on `obsidian`.
 *
 * A file is trusted only while its path is in the store AND the SHA-256 of its
 * current content equals the approved one. Stores are null-prototype objects so
 * that vault paths such as `__proto__` or `constructor` are plain keys.
 */

export interface TrustEntry {
	/** SHA-256 of the approved content, 64 lowercase hex characters. */
	sha256: string;
	/** When the operator approved it, ISO 8601. */
	trustedAt: string;
}

export type TrustStore = Record<string, TrustEntry>;

export type TrustDecision = "isolated" | "trusted" | "isolated-changed";

const HASH_RE = /^[0-9a-f]{64}$/;

export function emptyStore(): TrustStore {
	return Object.create(null) as TrustStore;
}

function cloneStore(store: TrustStore): TrustStore {
	const out = emptyStore();
	for (const key of Object.keys(store)) out[key] = store[key];
	return out;
}

function hasEntry(store: TrustStore, path: string): boolean {
	return Object.prototype.hasOwnProperty.call(store, path);
}

export function getEntry(store: TrustStore, path: string): TrustEntry | undefined {
	return hasEntry(store, path) ? store[path] : undefined;
}

export function decideMode(path: string, currentHash: string, store: TrustStore): TrustDecision {
	const entry = getEntry(store, path);
	if (!entry) return "isolated";
	return entry.sha256 === currentHash ? "trusted" : "isolated-changed";
}

export function trust(store: TrustStore, path: string, hash: string, now: Date = new Date()): TrustStore {
	if (!path || !HASH_RE.test(hash)) throw new Error("trust: invalid path or hash");
	const out = cloneStore(store);
	out[path] = { sha256: hash, trustedAt: now.toISOString() };
	return out;
}

export function revoke(store: TrustStore, path: string): TrustStore {
	const out = cloneStore(store);
	delete out[path];
	return out;
}

/** Follows a rename or move of a file, or of a folder (every entry under `oldPath/`). */
export function renamePath(store: TrustStore, oldPath: string, newPath: string): TrustStore {
	const moves = (key: string) => key === oldPath || key.startsWith(oldPath + "/");
	const out = emptyStore();
	for (const key of Object.keys(store)) {
		if (!moves(key)) out[key] = store[key];
	}
	// Moved entries are written last: one that lands on an existing path replaces it,
	// because the file now at that path is the moved one.
	for (const key of Object.keys(store)) {
		if (moves(key)) out[newPath + key.slice(oldPath.length)] = store[key];
	}
	return out;
}

/** Drops a deleted file, or every entry under a deleted folder. */
export function removePath(store: TrustStore, path: string): TrustStore {
	const out = emptyStore();
	for (const key of Object.keys(store)) {
		if (key === path || key.startsWith(path + "/")) continue;
		out[key] = store[key];
	}
	return out;
}

/** Validates what was loaded from `data.json`: malformed entries are dropped. Never throws. */
export function sanitizeStore(raw: unknown): TrustStore {
	const out = emptyStore();
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
	for (const key of Object.keys(raw)) {
		if (!key) continue;
		const value: unknown = (raw as Record<string, unknown>)[key];
		if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
		const { sha256, trustedAt } = value as Record<string, unknown>;
		if (typeof sha256 !== "string" || !HASH_RE.test(sha256)) continue;
		if (typeof trustedAt !== "string" || Number.isNaN(Date.parse(trustedAt))) continue;
		out[key] = { sha256, trustedAt };
	}
	return out;
}
