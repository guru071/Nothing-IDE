import { executeTool, getCurrentProject, TOOL_SPECS } from "./aiTools";
import config from "./config";

const MODEL = "gemini-2.0-flash";
const MAX_TOOL_ITERATIONS = 20;

const SYSTEM_PROMPT = `You are the AI Agent built into Nothing IDE, an Android code editor. You can read and write files in the user's currently open project, and run shell commands in its built-in Alpine Linux terminal sandbox. All file paths you use in tool calls are relative to the project root - never use absolute paths or "..". The app itself asks the user to approve every file write and shell command before it runs, so don't add your own extra confirmation step in the conversation - just call the tool. Be concise.`;

const TOOLS = [
	{
		functionDeclarations: TOOL_SPECS.map((spec) => ({
			name: spec.name,
			description: spec.description,
			parameters: spec.parameters,
		})),
	},
];

export function hasApiKey() {
	return Boolean(config.GEMINI_API_KEY);
}

export { getCurrentProject };

async function callGemini(apiKey, contents) {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
			contents,
			tools: TOOLS,
		}),
	});

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		throw new Error(
			`Gemini API error ${response.status}: ${body.slice(0, 300)}`,
		);
	}

	return response.json();
}

/**
 * Runs one user turn of the agent loop against Google's Gemini API. Same
 * tool set and behavior as the Anthropic agent (aiAgentService.js) - only
 * the request/response wire format differs.
 * @param {Array} history Gemini-format `contents` entries, ending with the new user turn
 * @param {{onConfirm: (title: string, message: string) => Promise<boolean>, onToolCall?: (name: string, input: object) => void}} handlers
 * @returns {Promise<{messages: Array, finalText: string, refused: boolean}>}
 */
export async function runAgentTurn(history, { onConfirm, onToolCall } = {}) {
	const apiKey = config.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("No Gemini API key set. Add one in Settings › AI Agent.");
	}

	const project = getCurrentProject();
	const contents = [...history];
	let iterations = 0;

	while (iterations++ < MAX_TOOL_ITERATIONS) {
		const response = await callGemini(apiKey, contents);
		const candidate = response.candidates?.[0];
		const parts = candidate?.content?.parts || [];
		if (!parts.length) {
			const blocked = candidate?.finishReason === "SAFETY";
			return { messages: contents, finalText: "", refused: blocked };
		}

		contents.push({ role: "model", parts });

		const functionCalls = parts.filter((part) => part.functionCall);
		if (!functionCalls.length) {
			const finalText = parts
				.filter((part) => typeof part.text === "string")
				.map((part) => part.text)
				.join("\n\n")
				.trim();
			return {
				messages: contents,
				finalText,
				refused: candidate.finishReason === "SAFETY",
			};
		}

		const responseParts = [];
		for (const part of functionCalls) {
			const { name, args } = part.functionCall;
			onToolCall?.(name, args || {});

			let resultText;
			try {
				const result = await executeTool(name, args || {}, {
					project,
					onConfirm,
				});
				resultText =
					result && typeof result === "object" && "content" in result
						? result.content
						: String(result);
			} catch (error) {
				resultText = `Error: ${error?.message || error}`;
			}

			responseParts.push({
				functionResponse: { name, response: { result: resultText } },
			});
		}

		contents.push({ role: "user", parts: responseParts });
	}

	throw new Error("The AI Agent reached its tool-call limit for this turn.");
}
