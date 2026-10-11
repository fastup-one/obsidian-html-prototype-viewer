/**
 * Minimal Chrome DevTools Protocol client for driving the isolated test
 * Obsidian on 127.0.0.1. Node built-ins only (fetch, WebSocket).
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn, { timeoutMs = 30000, everyMs = 250, what = "condition" } = {}) {
	const deadline = Date.now() + timeoutMs;
	let last;
	for (;;) {
		try {
			const value = await fn();
			if (value) return value;
		} catch (error) {
			last = error;
		}
		if (Date.now() > deadline) throw new Error(`timeout waiting for ${what}${last ? `: ${last.message}` : ""}`);
		await sleep(everyMs);
	}
}

const MAIN_WINDOW = (t) => t.type === "page" && t.url.startsWith("app://obsidian.md/index.html");

/** Obsidian 1.14+ opens its settings in a window of their own. */
export const SETTINGS_WINDOW = (t) => t.type === "page" && /^(Preferencias|Settings)\b/.test(t.title);

export async function connect(port, match = MAIN_WINDOW, { timeoutMs = 60000 } = {}) {
	const target = await waitFor(
		async () => {
			const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			return list.find(match);
		},
		{ timeoutMs, what: "the Obsidian window" },
	);
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((res, rej) => {
		ws.onopen = res;
		ws.onerror = rej;
	});

	let nextId = 1;
	const pending = new Map();
	const logs = [];
	const contexts = new Map();

	function send(method, params = {}, sessionId) {
		const id = nextId++;
		const msg = { id, method, params };
		if (sessionId) msg.sessionId = sessionId;
		ws.send(JSON.stringify(msg));
		return new Promise((res, rej) => pending.set(id, { res, rej }));
	}

	ws.onmessage = (ev) => {
		const m = JSON.parse(ev.data);
		if (m.id && pending.has(m.id)) {
			const { res, rej } = pending.get(m.id);
			pending.delete(m.id);
			if (m.error) rej(new Error(JSON.stringify(m.error)));
			else res(m.result);
			return;
		}
		const sid = m.sessionId || "";
		const where = sid ? "frame" : "main";
		switch (m.method) {
			case "Runtime.consoleAPICalled":
				logs.push({ where, type: m.params.type, text: m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ") });
				break;
			case "Log.entryAdded":
				logs.push({ where, type: m.params.entry.level, text: m.params.entry.text });
				break;
			case "Runtime.exceptionThrown":
				logs.push({ where, type: "exception", text: m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text });
				break;
			case "Runtime.executionContextCreated": {
				const c = m.params.context;
				contexts.set(`${sid}:${c.id}`, { sessionId: sid, id: c.id, frameId: c.auxData?.frameId, isDefault: c.auxData?.isDefault });
				break;
			}
			case "Runtime.executionContextDestroyed":
				contexts.delete(`${sid}:${m.params.executionContextId}`);
				break;
			case "Runtime.executionContextsCleared":
				for (const key of [...contexts.keys()]) if (key.startsWith(`${sid}:`)) contexts.delete(key);
				break;
			case "Target.attachedToTarget": {
				const s = m.params.sessionId;
				for (const method of ["Runtime.enable", "Log.enable", "Runtime.runIfWaitingForDebugger"]) send(method, {}, s).catch(() => {});
				break;
			}
		}
	};

	/** Every evaluation has a deadline: a step that never answers fails loudly instead of hanging the run. */
	async function evaluate(expression, { sessionId, contextId, awaitPromise = true, timeoutMs = 30000 } = {}) {
		const params = { expression, returnByValue: true, awaitPromise };
		if (contextId) params.contextId = contextId;
		let timer;
		const deadline = new Promise((_, rej) => {
			timer = setTimeout(() => rej(new Error(`no answer within ${timeoutMs} ms: ${expression.slice(0, 120)}`)), timeoutMs);
		});
		const r = await Promise.race([send("Runtime.evaluate", params, sessionId || undefined), deadline]).finally(() => clearTimeout(timer));
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
		return r.result.value;
	}

	/** Evaluates `expression` inside the frame of the iframe element returned by `iframeExpr` (main window). */
	async function frameEval(iframeExpr, expression) {
		const { result } = await send("Runtime.evaluate", { expression: iframeExpr, returnByValue: false });
		if (!result.objectId) throw new Error("iframe not found");
		const { node } = await send("DOM.describeNode", { objectId: result.objectId });
		const ctx = await waitFor(
			() => [...contexts.values()].find((c) => c.frameId === node.frameId && c.isDefault),
			{ timeoutMs: 10000, what: "the frame's execution context" },
		);
		return evaluate(expression, { sessionId: ctx.sessionId, contextId: ctx.id });
	}

	async function screenshot() {
		return Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64");
	}

	await send("Runtime.enable");
	await send("Log.enable");
	await send("Page.enable");
	await send("DOM.enable");
	await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });

	return { send, evaluate, frameEval, screenshot, logs, close: () => ws.close() };
}
