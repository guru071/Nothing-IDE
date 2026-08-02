import Anthropic from "@anthropic-ai/sdk";
import { executeTool, getCurrentProject, TOOL_SPECS } from "./aiTools";
import config from "./config";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 8192;
const MAX_TOOL_ITERATIONS = 20;

const SYSTEM_PROMPT = `You are the AI Agent built into Nothing IDE, an Android code editor. You can read and write files in the user's currently open project, and run shell commands in its built-in Alpine Linux terminal sandbox. All file paths you use in tool calls are relative to the project root - never use absolute paths or "..". The app itself asks the user to approve every file write and shell command before it runs, so don't add your own extra confirmation step in the conversation - just call the tool. Be concise.`;

const TOOLS = TOOL_SPECS.map((spec) => ({
	name: spec.name,
	description: spec.description,
	input_schema: spec.parameters,
}));

function getClient() {
	const apiKey = config.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error(
			"No Anthropic API key set. Add one in Settings › AI Agent.",
		);
	}
	return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export function hasApiKey() {
	return Boolean(config.ANTHROPIC_API_KEY);
}

export { getCurrentProject };

/**
 * Runs one user turn of the agent loop: sends `history` (an array of Anthropic
 * message objects, ending with the new user message) to Claude, executes any
 * tool calls it makes against the current project, and keeps looping until it
 * stops calling tools or `MAX_TOOL_ITERATIONS` is hit.
 * @param {Array} history
 * @param {{onConfirm: (title: string, message: string) => Promise<boolean>, onToolCall?: (name: string, input: object) => void}} handlers
 * @returns {Promise<{messages: Array, finalResponse: object}>}
 */
export async function runAgentTurn(history, { onConfirm, onToolCall } = {}) {
	const client = getClient();
	const project = getCurrentProject();
	const messages = [...history];
	let iterations = 0;

	while (iterations++ < MAX_TOOL_ITERATIONS) {
		const response = await client.messages.create({
			model: MODEL,
			max_tokens: MAX_TOKENS,
			system: SYSTEM_PROMPT,
			thinking: { type: "adaptive" },
			output_config: { effort: "high" },
			tools: TOOLS,
			messages,
		});

		messages.push({ role: "assistant", content: response.content });

		if (response.stop_reason !== "tool_use") {
			const finalText = response.content
				.filter((block) => block.type === "text")
				.map((block) => block.text)
				.join("\n\n")
				.trim();
			return {
				messages,
				finalText,
				refused: response.stop_reason === "refusal",
			};
		}

		const toolResults = [];
		for (const block of response.content) {
			if (block.type !== "tool_use") continue;
			onToolCall?.(block.name, block.input);

			let resultContent;
			let isError = false;
			try {
				const result = await executeTool(block.name, block.input, {
					project,
					onConfirm,
				});
				if (result && typeof result === "object" && "content" in result) {
					resultContent = result.content;
					isError = Boolean(result.isError);
				} else {
					resultContent = String(result);
				}
			} catch (error) {
				resultContent = `Error: ${error?.message || error}`;
				isError = true;
			}

			toolResults.push({
				type: "tool_result",
				tool_use_id: block.id,
				content: resultContent,
				is_error: isError,
			});
		}

		messages.push({ role: "user", content: toolResults });
	}

	throw new Error("The AI Agent reached its tool-call limit for this turn.");
}
