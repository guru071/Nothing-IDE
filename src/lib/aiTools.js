import fsOperation from "fileSystem";
import Url from "utils/Url";
import gitService from "./gitService";

/** Provider-agnostic tool descriptions (name/description/JSON-schema
 * parameters) shared by every AI provider's agent service - each provider
 * wraps these into its own wire format (Anthropic's input_schema, OpenAI's
 * function.parameters, Gemini's functionDeclarations.parameters are all
 * plain JSON Schema already, so no translation is needed beyond wrapping). */
export const TOOL_SPECS = [
	{
		name: "read_file",
		description:
			"Read a text file's contents from the currently open project. Path is relative to the project root.",
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Path relative to the project root",
				},
			},
			required: ["path"],
		},
	},
	{
		name: "list_directory",
		description:
			'List files and folders in a directory of the currently open project (non-recursive, one level deep). Use "." for the project root.',
		parameters: {
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
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Path relative to the project root",
				},
				content: {
					type: "string",
					description: "The full new content of the file",
				},
			},
			required: ["path", "content"],
		},
	},
	{
		name: "run_command",
		description:
			"Run a shell command in the built-in terminal sandbox, inside the currently open project's directory. Requires the Terminal feature to be installed. The user is asked to approve this before it runs.",
		parameters: {
			type: "object",
			properties: {
				command: { type: "string", description: "The shell command to run" },
			},
			required: ["command"],
		},
	},
];

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

/**
 * Executes one of the TOOL_SPECS tools against the current project. Shared
 * by every provider's agent service - the tool behavior doesn't depend on
 * which AI called it, only the request/response wire format does.
 * @param {string} name
 * @param {object} input
 * @param {{project: object, onConfirm: (title: string, message: string) => Promise<boolean>}} context
 * @returns {Promise<string|{content: string, isError: boolean}>}
 */
export async function executeTool(name, input, { project, onConfirm }) {
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
				return {
					content: "The Terminal feature isn't installed.",
					isError: true,
				};
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
