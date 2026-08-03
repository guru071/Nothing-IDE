import fsOperation from "fileSystem";
import setupScript from "./hardwareBridge/setup.sh";

const CAMERA_DIR_NAME = "camera-captures";
const SENSOR_DIR_NAME = "sensor-snapshots";

/**
 * Opens an interactive terminal and runs `script` in it (base64-piped, to
 * avoid any shell-quoting issues), so the user can watch install progress.
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
 * Provisions Python + OpenCV in the Alpine sandbox, in a visible terminal so
 * install progress is shown.
 */
function runSetup() {
	return runInTerminal("Python + OpenCV Setup", setupScript);
}

/**
 * Creates `name` under `parentUrl` if it doesn't already exist (idempotent -
 * the underlying `getDirectory({create:true})` call succeeds either way).
 * @param {string} parentUrl
 * @param {string} name
 * @returns {Promise<string>} url of the (now existing) directory
 */
function ensureDir(parentUrl, name) {
	return fsOperation(parentUrl).createDirectory(name);
}

/**
 * Resolves (and ensures the existence of) the given subfolder of the shared
 * `/public` folder - the same folder that's bind-mounted as `/public`
 * (and `$HOME`) inside the Alpine terminal sandbox, so anything written here
 * from JS shows up there immediately with no copying step.
 * @param {string} subfolder
 * @returns {Promise<string>} the Android-side (file://) url of the folder
 */
async function ensurePublicSubfolder(subfolder) {
	const publicUrl = await ensureDir(cordova.file.dataDirectory, "public");
	return ensureDir(publicUrl, subfolder);
}

function timestampSlug() {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Shows the OS's file/camera picker with a camera-capture hint
 * (`capture="environment"`). This is a plain HTML `<input type="file">` -
 * standard WebView/browser behaviour that hands off to the system camera
 * app, not a native Cordova plugin - so it works without adding any new
 * native code. On WebViews/OSes where the picker doesn't offer a direct
 * camera option, it falls back to a normal file/gallery picker instead of
 * failing outright.
 * @returns {Promise<File|null>} null if the user cancelled
 */
function pickPhoto() {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = "image/*";
		input.setAttribute("capture", "environment");
		input.style.display = "none";
		document.body.appendChild(input);

		let settled = false;
		const finish = (file) => {
			if (settled) return;
			settled = true;
			input.remove();
			resolve(file);
		};

		input.onchange = () => finish(input.files?.[0] || null);
		// Some WebViews don't fire 'change' on cancel; if the window regains
		// focus and nothing was picked shortly after, treat it as cancelled.
		window.addEventListener(
			"focus",
			() => setTimeout(() => finish(input.files?.[0] || null), 500),
			{ once: true },
		);

		input.click();
	});
}

/**
 * Captures a still photo (via the system camera, see {@link pickPhoto}) and
 * saves it into the shared `/public/camera-captures` folder, where it's
 * immediately readable from the terminal sandbox at
 * `/public/camera-captures/<filename>` - e.g. with OpenCV's `cv2.imread()`.
 *
 * This is frame-based (capture-then-process), not a live video stream: a
 * true live camera-to-Linux-process bridge would need Android's Camera2 API
 * wired into the sandbox at the native layer, which is out of scope here.
 *
 * @returns {Promise<{androidUrl:string, prootPath:string, filename:string, examplePath:string}|null>}
 *   null if the user cancelled the capture.
 */
async function capturePhoto() {
	const file = await pickPhoto();
	if (!file) return null;

	const dirUrl = await ensurePublicSubfolder(CAMERA_DIR_NAME);
	const filename = `photo_${timestampSlug()}.jpg`;
	const androidUrl = await fsOperation(dirUrl).createFile(filename, file);
	const prootPath = `/public/${CAMERA_DIR_NAME}/${filename}`;

	const exampleName = `analyze_${timestampSlug()}.py`;
	const examplePath = `/public/${CAMERA_DIR_NAME}/${exampleName}`;
	const exampleScript = [
		"import cv2",
		"",
		`path = "${prootPath}"`,
		"img = cv2.imread(path)",
		'if img is None:',
		'    raise SystemExit(f"Could not read {path}")',
		"",
		'print("shape:", img.shape)',
		"",
		"gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)",
		'out_path = path.rsplit(".", 1)[0] + "_gray.jpg"',
		"cv2.imwrite(out_path, gray)",
		'print("wrote:", out_path)',
		"",
	].join("\n");
	await fsOperation(dirUrl).createFile(exampleName, exampleScript);

	return { androidUrl, prootPath, filename, examplePath };
}

/**
 * Reads the device's current location once via the standard
 * `navigator.geolocation` web API. Resolves `null` (rather than rejecting)
 * on any failure/timeout/missing permission, so a snapshot with partial
 * data is still useful.
 */
function readGeolocationOnce() {
	return new Promise((resolve) => {
		if (!navigator.geolocation) {
			resolve(null);
			return;
		}
		const timer = setTimeout(() => resolve(null), 4000);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				clearTimeout(timer);
				resolve({
					latitude: pos.coords.latitude,
					longitude: pos.coords.longitude,
					accuracy: pos.coords.accuracy,
					altitude: pos.coords.altitude,
					speed: pos.coords.speed,
				});
			},
			() => {
				clearTimeout(timer);
				resolve(null);
			},
			{ timeout: 3500, maximumAge: 0 },
		);
	});
}

/**
 * Waits for a single `eventName` event (or a timeout) and resolves a plain
 * object built from it via `pick`, or `null` if none arrived in time -
 * used for the standard `devicemotion`/`deviceorientation` web APIs, which
 * some WebView builds gate behind a permissions policy and simply never
 * fire in that case.
 */
function readEventOnce(eventName, pick, timeoutMs = 2000) {
	return new Promise((resolve) => {
		let settled = false;
		const onEvent = (e) => finish(pick(e));
		const timer = setTimeout(() => finish(null), timeoutMs);
		function finish(data) {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			window.removeEventListener(eventName, onEvent);
			resolve(data);
		}
		window.addEventListener(eventName, onEvent);
	});
}

/**
 * Captures a one-off snapshot of whatever sensors the WebView exposes
 * (location, motion, orientation) and saves it as JSON into the shared
 * `/public/sensor-snapshots` folder. Like {@link capturePhoto}, this is a
 * snapshot, not a continuous stream - poll it repeatedly from a script if
 * you need periodic readings.
 * @returns {Promise<{androidUrl:string, prootPath:string, filename:string, snapshot:object}>}
 */
async function captureSensorSnapshot() {
	const [location, motion, orientation] = await Promise.all([
		readGeolocationOnce(),
		readEventOnce("devicemotion", (e) => ({
			acceleration: e.acceleration
				? { x: e.acceleration.x, y: e.acceleration.y, z: e.acceleration.z }
				: null,
			accelerationIncludingGravity: e.accelerationIncludingGravity
				? {
						x: e.accelerationIncludingGravity.x,
						y: e.accelerationIncludingGravity.y,
						z: e.accelerationIncludingGravity.z,
					}
				: null,
			rotationRate: e.rotationRate
				? {
						alpha: e.rotationRate.alpha,
						beta: e.rotationRate.beta,
						gamma: e.rotationRate.gamma,
					}
				: null,
			interval: e.interval,
		})),
		readEventOnce("deviceorientation", (e) => ({
			alpha: e.alpha,
			beta: e.beta,
			gamma: e.gamma,
			absolute: e.absolute,
		})),
	]);

	const snapshot = {
		capturedAt: new Date().toISOString(),
		location,
		motion,
		orientation,
	};

	const dirUrl = await ensurePublicSubfolder(SENSOR_DIR_NAME);
	const filename = `sensors_${timestampSlug()}.json`;
	const androidUrl = await fsOperation(dirUrl).createFile(
		filename,
		JSON.stringify(snapshot, null, 2),
	);
	const prootPath = `/public/${SENSOR_DIR_NAME}/${filename}`;

	return { androidUrl, prootPath, filename, snapshot };
}

/**
 * Registers the camera/sensor commands so they're reachable from the
 * command palette (Ctrl-Shift-P).
 */
function init() {
	window.acode.addCommand({
		name: "hardware-setup",
		description: "Set Up Python + OpenCV",
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
		name: "hardware-capture-photo",
		description: "Capture Photo for OpenCV",
		requiresView: false,
		exec: async () => {
			try {
				const result = await capturePhoto();
				if (!result) return; // cancelled
				const { default: alert } = await import("dialogs/alert");
				alert(
					"Photo captured",
					`Saved to the shared terminal folder:<br><br><code>${result.prootPath}</code><br><br>` +
						`A ready-made example script was saved next to it:<br><br><code>${result.examplePath}</code><br><br>` +
						`Try it in the terminal:<br><br><code>cd /public/${CAMERA_DIR_NAME} && python3 ${result.examplePath.split("/").pop()}</code>`,
				);
			} catch (error) {
				window.toast?.(`Capture failed: ${error?.message || error}`);
			}
		},
	});

	window.acode.addCommand({
		name: "hardware-capture-sensors",
		description: "Capture Sensor Snapshot",
		requiresView: false,
		exec: async () => {
			try {
				const result = await captureSensorSnapshot();
				const { default: alert } = await import("dialogs/alert");
				alert(
					"Sensor snapshot captured",
					`Saved to the shared terminal folder:<br><br><code>${result.prootPath}</code><br><br>` +
						`Fields that came back <code>null</code> weren't available on this device/WebView.`,
				);
			} catch (error) {
				window.toast?.(`Capture failed: ${error?.message || error}`);
			}
		},
	});
}

export default {
	init,
	runSetup,
	capturePhoto,
	captureSensorSnapshot,
};
