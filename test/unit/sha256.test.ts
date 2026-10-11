import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { sha256Hex } from "../../src/sha256";

const reference = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

test("NIST FIPS 180-4 vectors", () => {
	assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
	assert.equal(
		sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
		"248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
	);
	assert.equal(
		sha256Hex(
			"abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
		),
		"cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1",
	);
	assert.equal(sha256Hex("a".repeat(1_000_000)), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
});

test("padding boundaries match node:crypto", () => {
	for (const n of [1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129]) {
		const text = "x".repeat(n);
		assert.equal(sha256Hex(text), reference(text), `length ${n}`);
	}
});

test("non-ASCII text is hashed as UTF-8", () => {
	for (const text of ["ñandú", "Ελληνικά", "中文字符", "emoji 🧪🔒", "﻿<!doctype html>", "a\u0000b"]) {
		assert.equal(sha256Hex(text), reference(text), text);
	}
});

test("pseudo-random inputs match node:crypto", () => {
	let seed = 42;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
	for (let i = 0; i < 200; i++) {
		const length = next() % 300;
		let text = "";
		for (let j = 0; j < length; j++) text += String.fromCodePoint(next() % 0x2fff);
		assert.equal(sha256Hex(text), reference(text));
	}
});
