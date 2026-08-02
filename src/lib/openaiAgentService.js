import { executeTool, getCurrentProject, TOOL_SPECS } from "./aiTools";
import config from "./config";

const MODEL = "gpt-4o";
const MAX_TOOL_ITERATIONS = 20;

const SYSTEM_PROMPT = `You are the AI Agent built into Nothing IDE, an Android code editor. You can read and write files in the user's currently open project, and run shell commands in its built-in Alpine Linux terminal sandbox. All file paths you use in tool calls are relative to the project root - never use absolute paths or "..". The app itself asks the user to approve every file write and shell command before it runs, so don't add your own extra confirmation step in the conversation - just call the tool. Be concise.`;

const TOOLS = TOOL_SPECS.map((spec) => ({
	type: "function",
	function: {
		name: spec.name,
		description: spec.description,
		parameters: spec.parameters,
	},
}));

export function hasApiKey() {
	return Boolean(config.OPENAI_API_KEY);
}

export { getCurrentProject };

async function callOpenAi(apiKey, messages) {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: MODEL,
			messages,
			tools: TOOLS,
		}),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`OpenAI API error ${response.status}: ${body.slice(0, 300)}`,
		);
	}

	return response.json();
}

/**
 * Runs one user turn of the agent loop against OpenAI's Chat Completions API.
 * Same tool set and behavior as the Anthropic agent (aiAgentService.js) -
 * only the request/response wire format differs.
 * @param {Array} history OpenAI-format messages, ending with the new user message
 * @param {{onConfirm: (title: string, message: string) => Promise<boolean>, onToolCall?: (name: string, input: object) => void}} handlers
 * @returns {Promise<{messages: Array, finalText: string, refused: boolean}>}
 */
export async function runAgentTurn(history, { onConfirm, onToolCall } = {}) {
	const apiKey = config.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("No OpenAI API key set. Add one in Settings › AI Agent.");
	}

	const project = getCurrentProject();
	const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];
	let iterations = 0;

	while (iterations++ < MAX_TOOL_ITERATIONS) {
		const response = await callOpenAi(apiKey, messages);
		const choice = response.choices?.[0];
		const message = choice?.message;
		if (!message) throw new Error("OpenAI returned no response.");

		messages.push(message);

		if (!message.tool_calls?.length) {
			return {
				messages: messages.slice(1), // drop the injected system message
				finalText: message.content || "",
				refused: choice.finish_reason === "content_filter",
			};
		}

		for (const toolCall of message.tool_calls) {
			let input = {};
			try {
				input = JSON.parse(toolCall.function.arguments || "{}");
			} catch {
				// leave input as {} if the model produced malformed JSON
			}
			onToolCall?.(toolCall.function.name, input);

			let resultContent;
			try {
				const result = await executeTool(toolCall.function.name, input, {
					project,
					onConfirm,
				});
				resultContent =
					result && typeof result === "object" && "content" in result
						? result.content
						: String(result);
			} catch (error) {
				resultContent = `Error: ${error?.message || error}`;
			}

			messages.push({
				role: "tool",
				tool_call_id: toolCall.id,
				content: resultContent,
			});
		}
	}

	throw new Error("The AI Agent reached its tool-call limit for this turn.");
}
