import setupScript from "./guiDesktop/setup.sh";
import startScript from "./guiDesktop/start.sh";
import stopScript from "./guiDesktop/stop.sh";

const WEB_PORT = 6080;
const VNC_DISPLAY = 1;
const VNC_PORT = 5900 + VNC_DISPLAY;
const VIEWER_URL = `http://127.0.0.1:${WEB_PORT}/vnc.html?autoconnect=true&resize=remote`;

/**
 * Opens an interactive terminal and runs `script` in it (base64-piped, to
 * avoid any shell-quoting issues), so the user can watch live output (and,
 * for the desktop itself, interact with it - e.g. Ctrl+C to stop) instead of
 * waiting on a hidden command.
 * @param {string} title terminal tab title
 * @param {string} script shell script source to run
 */
async function runInTerminal(title, script) {
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

	const encoded = window.btoa(unescape(encodeURIComponent(script)));
	terminal.component.write(`echo '${encoded}' | base64 -d | sh\n`);
}

/**
 * Provisions TigerVNC (Xvnc), IceWM, and noVNC in the Alpine sandbox, in a
 * visible terminal so install progress is shown.
 */
function runSetup() {
	return runInTerminal("GUI Desktop Setup", setupScript);
}

/**
 * Starts the virtual X server, window manager, a terminal, and the noVNC
 * web bridge, in a visible terminal (Ctrl+C there stops everything). After a
 * few seconds - long enough for the server to come up - opens the built-in
 * in-app browser to the desktop automatically, so it shows up on the
 * phone's screen without an extra manual step.
 */
async function startDesktop() {
	await runInTerminal("GUI Desktop", startScript);
	setTimeout(() => {
		openViewer().catch(() => {});
	}, 4000);
}

/**
 * Force-stops the desktop (Xvnc/IceWM/xterm/noVNC), in case the terminal
 * tab running it was closed directly instead of via Ctrl+C.
 * @returns {Promise<string>}
 */
function stopDesktop() {
	return window.Executor.execute(stopScript, true);
}

/**
 * Opens (or re-opens) the noVNC viewer in the built-in in-app browser,
 * without touching the running desktop.
 */
async function openViewer() {
	const { default: browser } = await import(
		/* webpackChunkName: "browserPlugin" */ "plugins/browser"
	);
	browser.open(VIEWER_URL);
}

/**
 * Registers the GUI desktop commands so they're reachable from the command
 * palette (Ctrl-Shift-P).
 */
function init() {
	window.acode.addCommand({
		name: "gui-desktop-setup",
		description: "Set Up GUI Desktop (VNC)",
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
		name: "gui-desktop-start",
		description: "Start GUI Desktop",
		requiresView: false,
		exec: async () => {
			try {
				await startDesktop();
			} catch (error) {
				window.toast?.(`Failed to start GUI desktop: ${error?.message || error}`);
			}
		},
	});

	window.acode.addCommand({
		name: "gui-desktop-open-viewer",
		description: "Open GUI Desktop Viewer",
		requiresView: false,
		exec: async () => {
			try {
				await openViewer();
			} catch (error) {
				window.toast?.(`Failed to open viewer: ${error?.message || error}`);
			}
		},
	});

	window.acode.addCommand({
		name: "gui-desktop-stop",
		description: "Stop GUI Desktop",
		requiresView: false,
		exec: async () => {
			try {
				await stopDesktop();
				window.toast?.("GUI desktop stopped");
			} catch (error) {
				window.toast?.(`Failed to stop GUI desktop: ${error?.message || error}`);
			}
		},
	});
}

export default {
	init,
	runSetup,
	startDesktop,
	stopDesktop,
	openViewer,
	VIEWER_URL,
	VNC_PORT,
};
