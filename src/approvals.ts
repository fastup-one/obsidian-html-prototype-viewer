/**
 * Desktop approvals for mobile trust. Pure: no dependency on `obsidian`.
 *
 * On the mobile app a trusted file shares Obsidian's origin and reaches the
 * whole vault, so a file may only become trusted there if the desktop app
 * already trusted that exact content. The desktop writes this store (keyed by
 * SHA-256) next to the plugin; it reaches the phone through the vault's sync.
 */
import { TrustStore } from "./trust";

export interface Approval {
	/** Vault path the desktop trusted this content at (informational). */
	path: string;
	/** When the desktop trusted it, ISO 8601. */
	approvedAt: string;
}

/** SHA-256 (64 lowercase hex) → approval. Null-prototype object. */
export type ApprovalStore = Record<string, Approval>;

export const APPROVALS_FILE = "approvals.json";
const FORMAT_VERSION = 1;
const HASH_RE = /^[0-9a-f]{64}$/;

export function emptyApprovals(): ApprovalStore {
	return Object.create(null) as ApprovalStore;
}

/** The desktop's approvals are exactly its trusted contents: one entry per trusted hash. */
export function approvalsFromTrust(store: TrustStore): ApprovalStore {
	const out = emptyApprovals();
	for (const path of Object.keys(store).sort()) {
		const { sha256, trustedAt } = store[path];
		const existing = out[sha256];
		if (!existing || trustedAt > existing.approvedAt) out[sha256] = { path, approvedAt: trustedAt };
	}
	return out;
}

export function getApproval(store: ApprovalStore, hash: string): Approval | undefined {
	return Object.prototype.hasOwnProperty.call(store, hash) ? store[hash] : undefined;
}

export function serializeApprovals(store: ApprovalStore): string {
	const approvals: Record<string, Approval> = {};
	for (const hash of Object.keys(store).sort()) approvals[hash] = { ...store[hash] };
	return JSON.stringify({ version: FORMAT_VERSION, approvals }, null, "\t") + "\n";
}

/** Parses `approvals.json`. Anything unexpected yields no approvals (mobile then stays isolated). Never throws. */
export function parseApprovals(text: string | null | undefined): ApprovalStore {
	const out = emptyApprovals();
	if (typeof text !== "string") return out;
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return out;
	}
	if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
	const { version, approvals } = raw as Record<string, unknown>;
	if (version !== FORMAT_VERSION || typeof approvals !== "object" || approvals === null || Array.isArray(approvals)) {
		return out;
	}
	for (const hash of Object.keys(approvals)) {
		if (!HASH_RE.test(hash)) continue;
		const value: unknown = (approvals as Record<string, unknown>)[hash];
		if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
		const { path, approvedAt } = value as Record<string, unknown>;
		if (typeof path !== "string" || !path) continue;
		if (typeof approvedAt !== "string" || Number.isNaN(Date.parse(approvedAt))) continue;
		out[hash] = { path, approvedAt };
	}
	return out;
}
