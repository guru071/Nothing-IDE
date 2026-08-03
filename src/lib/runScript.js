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
	php: (f) => `php83 ${sh(f)}`,
	pl: (f) => `perl ${sh(f)}`,
	lua: (f) => `lua5.4 ${sh(f)}`,
	go: (f) => `go run ${sh(f)}`,
	java: (f) => `java ${sh(f)}`,
	c: (f) => `gcc ${sh(f)} -o /tmp/a.out && /tmp/a.out`,
	cpp: (f) => `g++ ${sh(f)} -o /tmp/a.out && /tmp/a.out`,
};

/**
 * Which binary each runner actually needs on PATH, and which Alpine apk
 * package(s) provide it if missing - package names verified against
 * pkgs.alpinelinux.org, not guessed (bash is omitted: init-alpine.sh
 * already installs it unconditionally as a required package).
 */
const RUNTIME_REQUIREMENTS = {
	py: { binary: "python3", packages: ["python3"] },
	js: { binary: "node", packages: ["nodejs"] },
	mjs: { binary: "node", packages: ["nodejs"] },
	cjs: { binary: "node", packages: ["nodejs"] },
	rb: { binary: "ruby", packages: ["ruby"] },
	php: { binary: "php83", packages: ["php83"] },
	pl: { binary: "perl", packages: ["perl"] },
	lua: { binary: "lua5.4", packages: ["lua5.4"] },
	go: { binary: "go", packages: ["go"] },
	java: { binary: "java", packages: ["openjdk17"] },
	c: { binary: "gcc", packages: ["gcc", "musl-dev"] },
	cpp: { binary: "g++", packages: ["g++", "musl-dev"] },
};

/**
 * Checks whether a runner's interpreter/compiler is already on PATH in the
 * Alpine sandbox (this also picks up anything the user already installed
 * themselves via the terminal - the check has no way to tell the
 * difference, which is exactly the point), and if not, offers to install
 * it with one tap instead of failing with a bare "command not found".
 * @param {string} ext
 * @returns {Promise<boolean>} true if it's available (already was, or was
 *   just installed) - false if missing and the user declined to install it
 */
async function ensureRuntimeAvailable(ext) {
	const requirement = RUNTIME_REQUIREMENTS[ext];
	if (!requirement) return true; // e.g. sh/bash - always present

	try {
		const check = `command -v ${requirement.binary} >/dev/null 2>&1 && echo FOUND || echo MISSING`;
		const result = await window.Executor.execute(check, true);
		if (result.includes("FOUND")) return true;
	} catch {
		// Sandbox not reachable yet - let the actual run attempt surface the
		// real error rather than guessing here.
		return true;
	}

	const { default: confirmDialog } = await import("dialogs/confirm");
	const packageList = requirement.packages.join(" ");
	const proceed = await confirmDialog(
		strings.info,
		`${requirement.binary} isn't installed yet. Install it now (apk add ${packageList})?`,
	);
	if (!proceed) return false;

	try {
		window.toast?.(`Installing ${requirement.binary}...`);
		await window.Executor.execute(`apk add --no-cache ${packageList}`, true);
		window.toast?.(`${requirement.binary} installed.`);
		return true;
	} catch (error) {
		window.toast?.(
			`Could not install ${requirement.binary}: ${error?.message || error}`,
		);
		return false;
	}
}

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
 * Whether the active file has a recognized terminal runner (.py, .c, .go,
 * ...) - used to decide whether the header Run button should execute it in
 * the terminal or fall back to the web-preview "run" command instead.
 * @returns {boolean}
 */
function hasTerminalRunner() {
	return buildActiveFileCommand() !== null;
}

/**
 * Runs the active file if it has a recognized runner, otherwise falls back
 * to detecting a runnable entry point in the open project.
 */
async function run() {
	const fileCommand = buildActiveFileCommand();
	if (fileCommand) {
		const ext = (fileCommand.name || "").split(".").pop()?.toLowerCase();
		const available = await ensureRuntimeAvailable(ext);
		if (!available) return;

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

export default { init, run, hasTerminalRunner };
