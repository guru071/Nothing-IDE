import buildScript from "./androidBuild/build.sh";
import setupScript from "./androidBuild/setup.sh";
import {
	addedFolder,
	convertToProotPath,
	isTerminalAccessiblePath,
} from "./openFolder";

/**
 * Returns the currently open project as an in-sandbox path, or null if no
 * folder is open or it isn't reachable from the terminal sandbox.
 * @returns {{ url: string, name: string, path: string } | null}
 */
function getProject() {
	const folder = addedFolder[0];
	if (!folder) return null;
	if (!isTerminalAccessiblePath(folder.url)) return null;
	return {
		url: folder.url,
		name: folder.title || folder.name,
		path: convertToProotPath(folder.url),
	};
}

/**
 * Opens an interactive terminal and runs `script` in it (base64-piped, to
 * avoid any shell-quoting issues), optionally cd-ing into `path` first, so
 * the user can watch live output instead of waiting on a hidden command.
 * @param {string} title terminal tab title
 * @param {string} script shell script source to run
 * @param {string} [path] in-sandbox path to cd into first
 */
async function runInTerminal(title, script, path) {
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

	if (path) {
		terminal.component.write(`cd '${path.replace(/'/g, "'\\''")}'\n`);
	}
	const encoded = window.btoa(unescape(encodeURIComponent(script)));
	terminal.component.write(`echo '${encoded}' | base64 -d | sh\n`);
}

/**
 * Provisions the on-device Android build toolchain (JDK, D8, android.jar,
 * aapt2 detection) in a visible terminal so download progress is shown.
 */
function runSetup() {
	return runInTerminal("Android Build Setup", setupScript);
}

/**
 * Builds a debug APK from `path` in a visible terminal.
 * @param {string} path in-sandbox project path
 * @param {string} name project display name, used for the terminal tab title
 */
function buildInTerminal(path, name) {
	return runInTerminal(`Build - ${name}`, buildScript, path);
}

/**
 * Registers the "Set Up Android Build Tools" and "Build Android APK"
 * commands so they're reachable from the command palette (Ctrl-Shift-P).
 */
function init() {
	window.acode.addCommand({
		name: "android-build-setup",
		description: "Set Up Android Build Tools",
		requiresView: false,
		exec: async () => {
			try {
				await runSetup();
			} catch (error) {
				window.toast?.(`Setup failed: ${error?.message || error}`);
			}
		},
	});

	window.acode.addCommand({
		name: "android-build-apk",
		description: "Build Android APK",
		requiresView: false,
		exec: async () => {
			const project = getProject();
			if (!project) {
				window.toast?.(
					"Open a project folder that's accessible from the built-in terminal first.",
				);
				return;
			}
			try {
				await buildInTerminal(project.path, project.name);
			} catch (error) {
				window.toast?.(`Build failed: ${error?.message || error}`);
			}
		},
	});
}

export default {
	init,
	getProject,
	runSetup,
	buildInTerminal,
};
