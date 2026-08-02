import { convertToProotPath, isTerminalAccessiblePath } from "./openFolder";

/**
 * Maps a file extension to a shell command template that runs it via the
 * matching interpreter/compiler inside the Alpine terminal sandbox.
 */
const RUNNERS = {
	py: (f) => `python3 ${sh(f)}`,
	js: (f) => `node ${sh(f)}`,
	mjs: (f) => `node ${sh(f)}`,
	cjs: (f) => `node ${sh(f)}`,
	sh: (f) => `sh ${sh(f)}`,
	bash: (f) => `bash ${sh(f)}`,
	rb: (f) => `ruby ${sh(f)}`,
	php: (f) => `php ${sh(f)}`,
	pl: (f) => `perl ${sh(f)}`,
	lua: (f) => `lua ${sh(f)}`,
	go: (f) => `go run ${sh(f)}`,
	java: (f) => `java ${sh(f)}`,
	c: (f) => `gcc ${sh(f)} -o /tmp/a.out && /tmp/a.out`,
	cpp: (f) => `g++ ${sh(f)} -o /tmp/a.out && /tmp/a.out`,
};

function sh(str = "") {
	return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

/**
 * Splits an in-sandbox path into its parent directory and file name, so the
 * runner command can `cd` there first (scripts that assume a relative
 * working directory - e.g. `open("data.txt")` - then behave as expected).
 * @param {string} prootPath
 * @returns {{ dir: string, name: string }}
 */
function splitPath(prootPath) {
	const idx = prootPath.lastIndexOf("/");
	if (idx <= 0) return { dir: "/", name: prootPath };
	return {
		dir: prootPath.slice(0, idx) || "/",
		name: prootPath.slice(idx + 1),
	};
}

/**
 * Builds the shell command to run the current active file, or null if it
 * isn't reachable from the terminal sandbox or has no recognized runner.
 * @returns {{ command: string, name: string } | null}
 */
function buildActiveFileCommand() {
	const activeFile = editorManager?.activeFile;
	const uri = activeFile?.uri;
	if (!uri || !isTerminalAccessiblePath(uri)) return null;

	const ext = (activeFile.filename || "").split(".").pop()?.toLowerCase();
	const runner = RUNNERS[ext];
	if (!runner) return null;

	const prootPath = convertToProotPath(uri);
	const { dir, name } = splitPath(prootPath);
	return {
		command: `cd ${sh(dir)} && ${runner(name)}`,
		name: activeFile.filename,
	};
}

/**
 * Builds a shell command for a whole project folder, for when the active
 * file (if any) doesn't have a recognized single-file runner - looks for a
 * package.json (npm run dev/start) or a main.py/app.py entry point.
 * @param {{ path: string }} project from gitService/androidBuilder-style getProject()
 * @returns {Promise<{ command: string, name: string } | null>}
 */
async function buildProjectCommand(project) {
	if (!project?.path) return null;
	const check = `cd ${sh(project.path)} && ( [ -f package.json ] && echo HAS_PKG || true ) && ( [ -f main.py ] && echo HAS_MAIN_PY || true ) && ( [ -f app.py ] && echo HAS_APP_PY || true )`;
	let out = "";
	try {
		out = await window.Executor.execute(check, true);
	} catch {
		return null;
	}

	if (out.includes("HAS_PKG")) {
		let scripts = {};
		try {
			const pkgJson = await window.Executor.execute(
				`cd ${sh(project.path)} && cat package.json`,
				true,
			);
			scripts = JSON.parse(pkgJson)?.scripts || {};
		} catch {
			// fall through to npm start
		}
		const scriptName = scripts.dev ? "dev" : scripts.start ? "start" : null;
		const command = scriptName ? `npm run ${scriptName}` : "npm start";
		return {
			command: `cd ${sh(project.path)} && ${command}`,
			name: "package.json",
		};
	}

	if (out.includes("HAS_MAIN_PY")) {
		return {
			command: `cd ${sh(project.path)} && python3 main.py`,
			name: "main.py",
		};
	}

	if (out.includes("HAS_APP_PY")) {
		return {
			command: `cd ${sh(project.path)} && python3 app.py`,
			name: "app.py",
		};
	}

	return null;
}

/**
 * Opens (or reuses) a terminal and runs `command` there.
 * @param {string} title
 * @param {string} command
 */
async function runCommandInTerminal(title, command) {
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

	terminal.component.write(`${command}\n`);
}

/**
 * Runs the active file if it has a recognized runner, otherwise falls back
 * to detecting a runnable entry point in the open project.
 */
async function run() {
	const fileCommand = buildActiveFileCommand();
	if (fileCommand) {
		await runCommandInTerminal(
			`Run - ${fileCommand.name}`,
			fileCommand.command,
		);
		return;
	}

	const { default: gitService } = await import("./gitService");
	const project = gitService.getProject();
	const projectCommand = await buildProjectCommand(project);
	if (projectCommand) {
		await runCommandInTerminal(
			`Run - ${projectCommand.name}`,
			projectCommand.command,
		);
		return;
	}

	throw new Error(
		"Don't know how to run this. Open a script file (.py, .js, .sh, ...) or a project with a package.json/main.py.",
	);
}

/**
 * Registers the "Run in Terminal" command (Ctrl-F5, distinct from the
 * existing F5 web-preview "Run" command).
 */
function init() {
	window.acode.addCommand({
		name: "run-in-terminal",
		description: "Run in Terminal",
		requiresView: false,
		bindKey: "Ctrl-F5",
		exec: async () => {
			try {
				await run();
			} catch (error) {
				window.toast?.(error?.message || String(error));
			}
		},
	});
}

export default { init, run };
