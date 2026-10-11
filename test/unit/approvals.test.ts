import { test } from "node:test";
import assert from "node:assert/strict";
import {
	approvalsFromTrust,
	emptyApprovals,
	getApproval,
	parseApprovals,
	serializeApprovals,
	withdrawnPaths,
	withoutPaths,
} from "../../src/approvals";
import { TrustStore, decideMode, emptyStore, trust } from "../../src/trust";

const H1 = "a".repeat(64);
const H2 = "b".repeat(64);
const T1 = new Date("2026-10-11T10:00:00.000Z");
const T2 = new Date("2026-10-11T12:00:00.000Z");

function store(entries: Array<[string, string, Date]>): TrustStore {
	let s = emptyStore();
	for (const [path, hash, when] of entries) s = trust(s, path, hash, when);
	return s;
}

test("approvals are exactly the desktop's trusted contents", () => {
	const a = approvalsFromTrust(store([["a.html", H1, T1], ["b.html", H2, T2]]));
	assert.deepEqual(Object.keys(a).sort(), [H1, H2]);
	assert.deepEqual({ ...getApproval(a, H1) }, { path: "a.html", approvedAt: T1.toISOString() });
	assert.equal(Object.getPrototypeOf(a), null);
	assert.deepEqual(Object.keys(approvalsFromTrust(emptyStore())), []);
});

test("same content trusted at two paths: one approval, the most recent", () => {
	const a = approvalsFromTrust(store([["old.html", H1, T1], ["new.html", H1, T2]]));
	assert.deepEqual(Object.keys(a), [H1]);
	assert.equal(getApproval(a, H1)?.path, "new.html");
});

test("serialize / parse round trip", () => {
	const a = approvalsFromTrust(store([["a.html", H1, T1], ["sub/b.html", H2, T2]]));
	const back = parseApprovals(serializeApprovals(a));
	assert.deepEqual({ ...back[H1] }, { ...a[H1] });
	assert.deepEqual({ ...back[H2] }, { ...a[H2] });
	assert.deepEqual(Object.keys(back).sort(), [H1, H2]);
});

test("parseApprovals: anything unexpected means no approvals", () => {
	for (const text of [null, undefined, "", "not json", "null", "[]", "42", '{"approvals":{}}', '{"version":2,"approvals":{}}', '{"version":1,"approvals":[]}', '{"version":1}']) {
		assert.deepEqual(Object.keys(parseApprovals(text)), [], String(text));
	}
	const mixed = JSON.stringify({
		version: 1,
		approvals: {
			[H1]: { path: "ok.html", approvedAt: T1.toISOString() },
			[H2.toUpperCase()]: { path: "upper.html", approvedAt: T1.toISOString() },
			short: { path: "short.html", approvedAt: T1.toISOString() },
			[H2]: { path: "", approvedAt: T1.toISOString() },
			["c".repeat(64)]: { path: "bad-date.html", approvedAt: "soon" },
			["d".repeat(64)]: "not an object",
			["e".repeat(64)]: null,
		},
	});
	assert.deepEqual(Object.keys(parseApprovals(mixed)), [H1]);
});

test("parseApprovals: a __proto__ key cannot pollute prototypes", () => {
	const text = `{"version":1,"approvals":{"__proto__":{"path":"x.html","approvedAt":"${T1.toISOString()}"}}}`;
	const a = parseApprovals(text);
	assert.deepEqual(Object.keys(a), []);
	assert.equal(({} as Record<string, unknown>).path, undefined);
	assert.equal(getApproval(emptyApprovals(), "__proto__"), undefined);
});

test("mobile rule: trusted only with a desktop approval of the current content", () => {
	const local = store([["a.html", H1, T1]]);
	const approved = (a: ReturnType<typeof emptyApprovals>) => (hash: string) => getApproval(a, hash) !== undefined;
	const withApproval = approvalsFromTrust(store([["a.html", H1, T1]]));
	const otherContent = approvalsFromTrust(store([["a.html", H2, T1]]));

	assert.equal(decideMode("a.html", H1, local, approved(withApproval)), "trusted");
	assert.equal(decideMode("a.html", H1, local, approved(emptyApprovals())), "isolated-unapproved");
	assert.equal(decideMode("a.html", H1, local, approved(otherContent)), "isolated-unapproved");
	// Without a local trust entry, or with changed content, the approval alone grants nothing.
	assert.equal(decideMode("b.html", H1, local, approved(withApproval)), "isolated");
	assert.equal(decideMode("a.html", H2, local, approved(withApproval)), "isolated-changed");
	// Desktop: no rule.
	assert.equal(decideMode("a.html", H1, local), "trusted");
});

test("withdrawn approvals cancel the phone's own consent", () => {
	const phone = store([["a.html", H1, T1], ["b.html", H2, T1]]);
	const approvals = approvalsFromTrust(store([["a.html", H1, T1]]));
	assert.deepEqual(withdrawnPaths(phone, approvals), ["b.html"]);
	assert.deepEqual(withdrawnPaths(phone, emptyApprovals()), ["a.html", "b.html"]);
	assert.deepEqual(withdrawnPaths(phone, approvalsFromTrust(phone)), []);
	const pruned = withoutPaths(phone, ["b.html"]);
	assert.deepEqual(Object.keys(pruned), ["a.html"]);
	assert.equal(Object.getPrototypeOf(pruned), null);
	assert.deepEqual(Object.keys(phone).sort(), ["a.html", "b.html"], "input untouched");
	// Re-approving later does not bring the consent back: the entry is gone.
	assert.equal(decideMode("b.html", H2, withoutPaths(phone, ["b.html"]), () => true), "isolated");
});
