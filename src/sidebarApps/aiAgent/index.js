import "./style.scss";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import * as claudeAgent from "lib/aiAgentService";
import { getCurrentProject } from "lib/aiTools";
import * as geminiAgent from "lib/geminiAgentService";
import * as offlineAi from "lib/offlineAi";
import * as openaiAgent from "lib/openaiAgentService";

const PROVIDER_STORAGE_KEY = "ai_agent_provider";

/** Every online provider the AI Agent panel can talk to. Each module exposes
 * the same `hasApiKey()`/`runAgentTurn(history, handlers)` contract
 * (see aiAgentService.js, openaiAgentService.js, geminiAgentService.js) even
 * though their wire formats and conversation-history shapes differ - so
 * conversation history is kept separately per provider below. */
const PROVIDERS = [
	{ id: "claude", label: "Claude", ...claudeAgent },
	{ id: "openai", label: "OpenAI", ...openaiAgent },
	{ id: "gemini", label: "Gemini", ...geminiAgent },
];

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement} */
let $body;
/** @type {HTMLTextAreaElement} */
let $input;
/** @type {HTMLButtonElement} */
let $sendButton;
/** @type {HTMLElement} */
let $headerEl;

let providerId = localStorage.getItem(PROVIDER_STORAGE_KEY) || PROVIDERS[0].id;
let conversations = { claude: [], openai: [], gemini: [] };
let offlineConversation = [];
let displayMessages = [];
let sending = false;
let offlineMode = false;

function getProvider() {
	return PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];
}

export default [
	"chat_bubble", // icon
	"ai-agent", // id
	"AI Agent", // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
];

function buildHeader() {
	return (
		<div className="header">
			<div className="title">
				AI Agent
				<span>
					{!offlineMode && (
						<button
							type="button"
							className="mode-button"
							title="Switch AI provider"
							onclick={() => cycleProvider()}
						>
							{getProvider().label}
						</button>
					)}
					<button
						type="button"
						className="mode-button"
						title="Toggle online/offline mode"
						onclick={() => toggleMode()}
					>
						{offlineMode ? "Offline" : "Online"}
					</button>
					<button
						type="button"
						className="icon-button"
						title="New chat"
						onclick={() => newChat()}
					>
						<span className="icon delete_outline"></span>
					</button>
					<button
						type="button"
						className="icon-button"
						title="AI Agent settings"
						onclick={() => window.acode?.exec("open", "settings")}
					>
						<span className="icon settings"></span>
					</button>
				</span>
			</div>
		</div>
	);
}

function initApp(el) {
	container = el;
	container.classList.add("ai-agent-panel");
	$headerEl = buildHeader();
	container.content = $headerEl;

	$body = <div className="ai-agent-body scroll"></div>;

	$input = (
		<textarea
			className="ai-agent-input"
			placeholder="Ask the AI Agent to read, write, or run something in this project…"
			rows="2"
		></textarea>
	);
	$input.onkeydown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send();
		}
	};

	$sendButton = (
		<button
			type="button"
			className="action-button send-button"
			onclick={() => send()}
		>
			<span className="icon file_downloadget_app"></span> Send
		</button>
	);

	const $inputBar = (
		<div className="ai-agent-input-bar">
			{$input}
			{$sendButton}
		</div>
	);

	container.append($body, $inputBar);
	Sidebar.on("show", onSelected);
	render();
}

function onSelected() {
	// Nothing to refresh on show - conversation state is kept in memory only.
}

function newChat() {
	conversations = { claude: [], openai: [], gemini: [] };
	offlineConversation = [];
	displayMessages = [];
	render();
}

function refreshHeader() {
	const newHeader = buildHeader();
	$headerEl.replaceWith(newHeader);
	$headerEl = newHeader;
}

function cycleProvider() {
	const idx = PROVIDERS.findIndex((p) => p.id === providerId);
	providerId = PROVIDERS[(idx + 1) % PROVIDERS.length].id;
	localStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
	refreshHeader();
}

function toggleMode() {
	offlineMode = !offlineMode;
	refreshHeader();
	$input.placeholder = offlineMode
		? "Chat with the offline model (no file/shell access, conversation only)…"
		: "Ask the AI Agent to read, write, or run something in this project…";
}

function escapeHtml(str = "") {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function render() {
	if (!$body) return;
	$body.textContent = "";

	if (!displayMessages.length) {
		$body.append(
			<div className="empty-state">
				<p>
					Ask the AI Agent to explain, write, fix, or run something in your open
					project.
				</p>
				<p className="hint">
					It can read and write files and run shell commands here, but always
					asks before it writes or runs anything.
				</p>
			</div>,
		);
		return;
	}

	for (const message of displayMessages) {
		$body.append(
			<div className={`chat-message role-${message.role}`}>
				<div
					className="chat-message-text"
					innerHTML={escapeHtml(message.text).replace(/\n/g, "<br>")}
				></div>
			</div>,
		);
	}

	$body.scrollTop = $body.scrollHeight;
}

async function send() {
	if (sending) return;
	const text = $input.value.trim();
	if (!text) return;

	if (offlineMode) {
		$input.value = "";
		await sendOffline(text);
		return;
	}

	const provider = getProvider();

	if (!provider.hasApiKey()) {
		toast(`Add your ${provider.label} API key in Settings › AI Agent first.`);
		return;
	}
	if (!getCurrentProject()) {
		toast("Open a project folder first.");
		return;
	}

	$input.value = "";
	displayMessages.push({ role: "user", text });
	conversations[provider.id].push({ role: "user", content: text });
	render();

	sending = true;
	$sendButton.disabled = true;
	loader.showTitleLoader();

	try {
		const { messages, finalText, refused } = await provider.runAgentTurn(
			conversations[provider.id],
			{
				onConfirm: (title, message) => confirm(title, message),
				onToolCall: (name, input) => {
					const label =
						name === "run_command"
							? `Running: ${input.command}`
							: name === "write_file"
								? `Writing ${input.path}`
								: name === "read_file"
									? `Reading ${input.path}`
									: `Listing ${input.path || "."}`;
					displayMessages.push({ role: "tool", text: label });
					render();
				},
			},
		);

		conversations[provider.id] = messages;

		if (refused) {
			displayMessages.push({
				role: "error",
				text: `${provider.label} declined to respond to that request.`,
			});
		} else {
			displayMessages.push({
				role: "assistant",
				text: finalText || "(no response)",
			});
		}
	} catch (error) {
		displayMessages.push({
			role: "error",
			text: String(error?.message || error),
		});
	} finally {
		sending = false;
		$sendButton.disabled = false;
		loader.removeTitleLoader();
		render();
	}
}

/**
 * Offline mode: a plain, tool-free conversation with a small local model
 * running in the terminal sandbox (llama.cpp + Qwen2.5-0.5B) - no file/shell
 * access, unlike the online AI Agent, since small quantized on-device models
 * don't reliably support tool use.
 * @param {string} text
 */
async function sendOffline(text) {
	displayMessages.push({ role: "user", text });
	offlineConversation.push({ role: "user", content: text });
	render();

	sending = true;
	$sendButton.disabled = true;
	loader.showTitleLoader();

	try {
		const running = await offlineAi.isServerRunning();
		if (!running) {
			const setUp = await offlineAi.isSetUp();
			if (!setUp) {
				const proceed = await confirm(
					"Offline AI isn't set up",
					"This installs llama.cpp and downloads a ~450MB model in a terminal tab (one-time, needs internet once). Continue?",
				);
				if (proceed) {
					await offlineAi.runSetup();
					displayMessages.push({
						role: "tool",
						text: 'Watch the terminal tab for setup progress. Once it says "Offline AI is ready", try sending again.',
					});
				}
			} else {
				await offlineAi.startServer();
				displayMessages.push({
					role: "tool",
					text: "Starting the offline model in a terminal tab - try sending again in a few seconds.",
				});
			}
			return;
		}

		const reply = await offlineAi.chatCompletion(offlineConversation);
		offlineConversation.push({ role: "assistant", content: reply });
		displayMessages.push({
			role: "assistant",
			text: reply || "(no response)",
		});
	} catch (error) {
		displayMessages.push({
			role: "error",
			text: String(error?.message || error),
		});
	} finally {
		sending = false;
		$sendButton.disabled = false;
		loader.removeTitleLoader();
		render();
	}
}
