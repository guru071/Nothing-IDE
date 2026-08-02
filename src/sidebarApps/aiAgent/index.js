import "./style.scss";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import {
	getCurrentProject,
	hasApiKey,
	runAgentTurn,
} from "lib/aiAgentService";

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement} */
let $body;
/** @type {HTMLTextAreaElement} */
let $input;
/** @type {HTMLButtonElement} */
let $sendButton;

let conversation = [];
let displayMessages = [];
let sending = false;

export default [
	"chat_bubble", // icon
	"ai-agent", // id
	"AI Agent", // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
];

const $header = (
	<div className="header">
		<div className="title">
			AI Agent
			<span>
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

function initApp(el) {
	container = el;
	container.classList.add("ai-agent-panel");
	container.content = $header;

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
		<button type="button" className="action-button send-button" onclick={() => send()}>
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
	conversation = [];
	displayMessages = [];
	render();
}

function escapeHtml(str = "") {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function extractText(content) {
	return content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n\n")
		.trim();
}

function render() {
	if (!$body) return;
	$body.textContent = "";

	if (!displayMessages.length) {
		$body.append(
			<div className="empty-state">
				<p>Ask the AI Agent to explain, write, fix, or run something in your open project.</p>
				<p className="hint">
					It can read and write files and run shell commands here, but always asks before it
					writes or runs anything.
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

	if (!hasApiKey()) {
		toast("Add your Anthropic API key in Settings › AI Agent first.");
		return;
	}
	if (!getCurrentProject()) {
		toast("Open a project folder first.");
		return;
	}

	$input.value = "";
	displayMessages.push({ role: "user", text });
	conversation.push({ role: "user", content: text });
	render();

	sending = true;
	$sendButton.disabled = true;
	loader.showTitleLoader();

	try {
		const { messages, finalResponse } = await runAgentTurn(conversation, {
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
		});

		conversation = messages;

		if (finalResponse.stop_reason === "refusal") {
			displayMessages.push({
				role: "error",
				text: "Claude declined to respond to that request.",
			});
		} else {
			const text = extractText(finalResponse.content);
			displayMessages.push({
				role: "assistant",
				text: text || "(no response)",
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
