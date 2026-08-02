const DEFAULT_BASE_URL = "https://nothing-ide-goatech-d3fa1ace.vercel.app";
const PLUGIN_SERVER_OVERRIDE_KEY = "custom_plugin_server_url";
const ANTHROPIC_API_KEY_STORAGE_KEY = "anthropic_api_key";
let hasPro = false;

const config = {
	// The plugin marketplace's base URL. Defaults to our own self-hosted
	// server (see /server in this repo) - no dependency on acode.app. Point
	// this at a different server via Settings > Plugins > Plugin Server,
	// without needing an app rebuild.
	get BASE_URL() {
		return localStorage.getItem(PLUGIN_SERVER_OVERRIDE_KEY) || DEFAULT_BASE_URL;
	},

	set BASE_URL(value) {
		const trimmed = String(value || "").trim().replace(/\/+$/, "");
		if (!trimmed || trimmed === DEFAULT_BASE_URL) {
			localStorage.removeItem(PLUGIN_SERVER_OVERRIDE_KEY);
		} else {
			localStorage.setItem(PLUGIN_SERVER_OVERRIDE_KEY, trimmed);
		}
	},

	get DEFAULT_BASE_URL() {
		return DEFAULT_BASE_URL;
	},

	// User-supplied Anthropic API key for the AI Agent panel. Stored on-device
	// only (localStorage) - never bundled into the app, never sent anywhere but
	// api.anthropic.com directly from this device.
	get ANTHROPIC_API_KEY() {
		return localStorage.getItem(ANTHROPIC_API_KEY_STORAGE_KEY) || "";
	},

	set ANTHROPIC_API_KEY(value) {
		const trimmed = String(value || "").trim();
		if (!trimmed) {
			localStorage.removeItem(ANTHROPIC_API_KEY_STORAGE_KEY);
		} else {
			localStorage.setItem(ANTHROPIC_API_KEY_STORAGE_KEY, trimmed);
		}
	},

	SUPPORTED_EDITOR: "cm",
	FILE_NAME_REGEX: /^((?![:<>"\\\|\?\*]).)*$/,
	FONT_SIZE: /^[0-9\.]{1,3}(px|rem|em|pt|mm|pc|in)$/,
	DEFAULT_FILE_SESSION: "default-session",
	DEFAULT_FILE_NAME: "untitled.txt",
	CONSOLE_PORT: 8159,
	SERVER_PORT: 8158,
	PREVIEW_PORT: 8158,
	VIBRATION_TIME: 30,
	VIBRATION_TIME_LONG: 150,
	SCROLL_SPEED_FAST_X2: "FAST_X2",
	SCROLL_SPEED_NORMAL: "NORMAL",
	SCROLL_SPEED_FAST: "FAST",
	SCROLL_SPEED_SLOW: "SLOW",
	SIDEBAR_SLIDE_START_THRESHOLD_PX: 20,
	CUSTOM_THEME: 'body[theme="custom"]',
	ERUDA_CDN: "https://cdn.jsdelivr.net/npm/eruda",

	get PLAY_STORE_URL() {
		return `https://play.google.com/store/apps/details?id=${BuildInfo.packageName}`;
	},

	get API_BASE() {
		return `${config.BASE_URL}/api`;
	},

	LOG_FILE_NAME: "NothingIDE.log",

	// This build has no paid tier - everything is unlocked, no ads, no purchases.
	get HAS_PRO() {
		return true;
	},

	set HAS_PRO(_value) {
		// no-op: always pro
	},
};

export default config;
