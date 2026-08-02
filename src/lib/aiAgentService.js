import Anthropic from "@anthropic-ai/sdk";
import fsOperation from "fileSystem";
import Url from "utils/Url";
import config from "./config";
import gitService from "./gitService";

const MODEL = "claude-opus-5";
const MAX_TOKENS = 8192;
const MAX_TOOL_ITERATIONS = 20;

const SYSTEM_PROMPT = `You are the AI Agent built into Nothing IDE, an Android code editor. You can read and write files in the user's currently open project, and run shell commands in its built-in Alpine Linux terminal sandbox. All file paths you use in tool calls are relative to the project root - never use absolute paths or "..". The app itself asks the user to approve every file write and shell command before it runs, so don't add your own extra confirmation step in the conversation - just call the tool. Be concise.`;

const TOOLS = [
	{
		name: "read_file",
		description:
			"Read a text file's contents from the currently open project. Path is relative to the project root.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path relative to the project root" },
			},
			required: ["path"],
		},
	},
	{
		name: "list_directory",
		description:
			'List files and folders in a directory of the currently open project (non-recursive, one level deep). Use "." for the project root.',
		input_schema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: 'Path relative to the project root, or "." for the root',
				},
			},
			required: ["path"],
		},
	},
	{
		name: "write_file",
		description:
			"Create a new file or overwrite an existing one in the currently open project with new content. Path is relative to the project root. Missing parent directories are created automatically. The user is asked to approve this before it runs.",
		input_schema: {
			type: "object",
			properties: {
				path: { type: "string", description: "Path relative to the project root" },
				content: { type: "string", description: "The full new content of the file" },
			},
			required: ["path", "content"],
		},
	},
	{
		name: "run_command",
		description:
			"Run a shell command in the built-in terminal sandbox, inside the currently open project's directory. Requires the Terminal feature to be installed. The user is asked to approve this before it runs.",
		input_schema: {
			type: "object",
			properties: {
				command: { type: "string", description: "The shell command to run" },
			},
			required: ["command"],
		},
	},
];

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

export function getCurrentProject() {
	return gitService.getProject();
}

function assertSafeRelativePath(path) {
	const value = String(path ?? "");
	if (
		!value ||
		value.startsWith("/") ||
		value.includes("://") ||
		value.split("/").includes("..")
	) {
		throw new Error(`Refusing to use this path: ${path}`);
	}
}

function shellEscape(str = "") {
	return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

async function ensureDirectoryPath(rootUrl, segments) {
	let currentUrl = rootUrl;
	for (const segment of segments) {
		if (!segment) continue;
		const dirUrl = Url.join(currentUrl, segment);
		const exists = await fsOperation(dirUrl)
			.exists()
			.catch(() => false);
		if (!exists) {
			await fsOperation(currentUrl).createDirectory(segment);
		}
		currentUrl = dirUrl;
	}
	return currentUrl;
}

async function executeTool(name, input, { project, onConfirm }) {
	if (!project) {
		return { content: "No project folder is open.", isError: true };
	}

	switch (name) {
		case "read_file": {
			assertSafeRelativePath(input.path);
			const url = Url.join(project.url, input.path);
			const content = await fsOperation(url).readFile("utf8");
			return String(content);
		}

		case "list_directory": {
			const relPath = input.path && input.path !== "." ? input.path : "";
			if (relPath) assertSafeRelativePath(relPath);
			const url = relPath ? Url.join(project.url, relPath) : project.url;
			const entries = await fsOperation(url).lsDir();
			if (!entries.length) return "(empty directory)";
			return entries
				.map((entry) => `${entry.isDirectory ? "d" : "f"}  ${entry.name}`)
				.join("\n");
		}

		case "write_file": {
			assertSafeRelativePath(input.path);
			const preview =
				input.content.length > 800
					? `${input.content.slice(0, 800)}\n... (truncated)`
					: input.content;
			const approved = await onConfirm(
				"Write file",
				`Allow the AI Agent to write to "${input.path}"?\n\n${preview}`,
			);
			if (!approved) {
				return { content: "The user declined this file write.", isError: true };
			}

			const parts = input.path.split("/").filter(Boolean);
			const fileName = parts.pop();
			const parentUrl = await ensureDirectoryPath(project.url, parts);
			const fileUrl = Url.join(parentUrl, fileName);
			const exists = await fsOperation(fileUrl)
				.exists()
				.catch(() => false);
			if (exists) {
				await fsOperation(fileUrl).writeFile(input.content, "utf8");
			} else {
				await fsOperation(parentUrl).createFile(fileName, input.content);
			}
			return `Wrote ${input.content.length} characters to ${input.path}`;
		}

		case "run_command": {
			if (!project.path) {
				return {
					content: "This project isn't accessible from the built-in terminal.",
					isError: true,
				};
			}
			if (typeof window.Executor?.execute !== "function") {
				return { content: "The Terminal feature isn't installed.", isError: true };
			}
			const approved = await onConfirm(
				"Run command",
				`Allow the AI Agent to run this command?\n\n${input.command}`,
			);
			if (!approved) {
				return { content: "The user declined this command.", isError: true };
			}
			const output = await window.Executor.execute(
				`cd ${shellEscape(project.path)} && ${input.command}`,
				true,
			);
			return String(output ?? "");
		}

		default:
			return { content: `Unknown tool: ${name}`, isError: true };
	}
}

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
			return { messages, finalResponse: response };
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
