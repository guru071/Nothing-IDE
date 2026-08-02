import setupScript from "./offlineAi/setup.sh";
import startScript from "./offlineAi/start.sh";
import stopScript from "./offlineAi/stop.sh";

const PORT = 8090;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Opens an interactive terminal and runs `script` in it (base64-piped, to
 * avoid any shell-quoting issues), so the user can watch live output - same
 * pattern used by the GUI Desktop feature.
 * @param {string} title terminal tab title
 * @param {string} script shell script source to run
 */
async function runInTerminal(title, script) {
	const { TerminalManager } = await import(
		/* webpackChunkName: "terminal" */ "components/terminal"
	);
	const terminal = await TerminalManager.createTerminal({
		name: title,
		render: true,
	});
	if (!terminal?.component) {
		throw new Error("Failed to open a terminal.");
	}

	await new Promise((resolve, reject) => {
		const start = Date.now();
		const check = () => {
			if (terminal.component.isConnected) resolve();
			else if (Date.now() - start > 5000)
				reject(new Error("Terminal connection timeout"));
			else setTimeout(check, 50);
		};
		check();
	});

	const encoded = window.btoa(unescape(encodeURIComponent(script)));
	terminal.component.write(`echo '${encoded}' | base64 -d | sh\n`);
}

/** Installs llama.cpp and downloads the offline model, in a visible terminal. */
export function runSetup() {
	return runInTerminal("Offline AI Setup", setupScript);
}

/** Starts the local model server, in a visible terminal (Ctrl+C there stops it). */
export function startServer() {
	return runInTerminal("Offline AI", startScript);
}

/** Force-stops the model server, in case its terminal tab was closed directly. */
export function stopServer() {
	return window.Executor.execute(stopScript, true);
}

/** Whether setup.sh has already installed llama.cpp and downloaded the model. */
export async function isSetUp() {
	try {
		const output = await window.Executor.execute(
			'test -f "$HOME/.offline-ai/setup-status" && echo yes || echo no',
			true,
		);
		return String(output).includes("yes");
	} catch {
		return false;
	}
}

/** Quick liveness check against the local model server. */
export async function isServerRunning() {
	try {
		const response = await fetch(`${BASE_URL}/health`, {
			signal: AbortSignal.timeout(1500),
		});
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Sends a plain chat completion request to the local offline model. No tool
 * use here - small quantized on-device models don't reliably support
 * function-calling, so offline mode is conversational only (no file/shell
 * access), unlike the online AI Agent.
 * @param {Array<{role: string, content: string}>} messages
 * @param {{maxTokens?: number}} [options]
 * @returns {Promise<string>}
 */
export async function chatCompletion(messages, { maxTokens = 512 } = {}) {
	const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			messages,
			max_tokens: maxTokens,
			stream: false,
		}),
	});

	if (!response.ok) {
		throw new Error(`Offline AI server error ${response.status}`);
	}

	const data = await response.json();
	return data.choices?.[0]?.message?.content || "";
}
