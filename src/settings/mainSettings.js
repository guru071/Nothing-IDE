import settingsPage from "components/settingsPage";
import confirm from "dialogs/confirm";
import rateBox from "dialogs/rateBox";
import actionStack from "lib/actionStack";
import config from "lib/config";
import openFile from "lib/openFile";
import appSettings from "lib/settings";
import settings from "lib/settings";
import plugins from "pages/plugins";
import themeSetting from "pages/themeSetting";
import helpers from "utils/helpers";
import About from "../pages/about";
import Account from "../pages/account/account";
import otherSettings from "./appSettings";
import backupRestore from "./backupRestore";
import editorSettings from "./editorSettings";
import filesSettings from "./filesSettings";
import formatterSettings from "./formatterSettings";
import lspSettings from "./lspSettings";
import previewSettings from "./previewSettings";
import scrollSettings from "./scrollSettings";
import searchSettings from "./searchSettings";
import terminalSettings from "./terminalSettings";

export default function mainSettings() {
	const title = strings.settings.capitalize();
	const categories = {
		core: strings["settings-category-core"],
		customizationTools: strings["settings-category-customization-tools"],
		maintenance: strings["settings-category-maintenance"],
		aboutAcode: strings["settings-category-about-acode"],
		supportAcode: strings["settings-category-support-acode"],
	};
	const items = [
		{
			key: "account",
			text: "Account",
			icon: "account_circle",
			info: "Sign in with GitHub or Google - needed to buy paid plugins and keep them across devices.",
			category: categories.core,
			chevron: true,
		},
		{
			key: "app-settings",
			text: strings["app settings"],
			icon: "tune",
			info: strings["settings-info-main-app-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "editor-settings",
			text: strings["editor settings"],
			icon: "text_format",
			info: strings["settings-info-main-editor-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "terminal-settings",
			text: `${strings["terminal settings"]}`,
			icon: "terminal",
			info: strings["settings-info-main-terminal-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "preview-settings",
			text: strings["preview settings"],
			icon: "public",
			info: strings["settings-info-main-preview-settings"],
			category: categories.core,
			chevron: true,
		},
		{
			key: "formatter",
			text: strings.formatter,
			icon: "spellcheck",
			info: strings["settings-info-main-formatter"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "theme",
			text: strings.theme,
			icon: "color_lenspalette",
			info: strings["settings-info-main-theme"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "plugins",
			text: strings["plugins"],
			icon: "extension",
			info: strings["settings-info-main-plugins"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "pluginServer",
			text: "Plugin server",
			icon: "cloud",
			value: config.BASE_URL,
			prompt: "Plugin server URL",
			promptType: "url",
			info: "Where the plugin marketplace is hosted. Defaults to our own self-hosted server; point this at a different one instead.",
			category: categories.customizationTools,
		},
		{
			key: "anthropicApiKey",
			text: "AI Agent: Claude API key",
			icon: "chat_bubble",
			value: config.ANTHROPIC_API_KEY,
			valueText: (value) => (value ? "••••••••" : "Not set"),
			prompt: "Anthropic API key",
			promptType: "password",
			info: "Your own Anthropic API key, used only to call Claude directly from this device for the AI Agent panel. Get one at console.anthropic.com. Nothing IDE never sees or stores this key anywhere but on your device.",
			category: categories.customizationTools,
		},
		{
			key: "openaiApiKey",
			text: "AI Agent: OpenAI API key",
			icon: "chat_bubble",
			value: config.OPENAI_API_KEY,
			valueText: (value) => (value ? "••••••••" : "Not set"),
			prompt: "OpenAI API key",
			promptType: "password",
			info: "Your own OpenAI API key, used only to call OpenAI directly from this device for the AI Agent panel. Get one at platform.openai.com. Nothing IDE never sees or stores this key anywhere but on your device.",
			category: categories.customizationTools,
		},
		{
			key: "geminiApiKey",
			text: "AI Agent: Gemini API key",
			icon: "chat_bubble",
			value: config.GEMINI_API_KEY,
			valueText: (value) => (value ? "••••••••" : "Not set"),
			prompt: "Google Gemini API key",
			promptType: "password",
			info: "Your own Google Gemini API key, used only to call Gemini directly from this device for the AI Agent panel. Get one at aistudio.google.com/apikey. Nothing IDE never sees or stores this key anywhere but on your device.",
			category: categories.customizationTools,
		},
		{
			key: "lsp-settings",
			text:
				strings?.lsp_settings ||
				strings["language servers"] ||
				"Language servers",
			icon: "zap",
			info: strings["settings-info-main-lsp-settings"],
			category: categories.customizationTools,
			chevron: true,
		},
		{
			key: "backup-restore",
			text: `${strings.backup.capitalize()} & ${strings.restore.capitalize()}`,
			icon: "cached",
			info: strings["settings-info-main-backup-restore"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "editSettings",
			text: `${strings["edit"]} settings.json`,
			icon: "edit",
			info: strings["settings-info-main-edit-settings"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "reset",
			text: strings["restore default settings"],
			icon: "historyrestore",
			info: strings["settings-info-main-reset"],
			category: categories.maintenance,
			chevron: true,
		},
		{
			key: "about",
			text: strings.about,
			icon: "info",
			info: `Version ${BuildInfo.version}`,
			category: categories.aboutAcode,
			chevron: true,
		},
		{
			key: "rateapp",
			text: strings["rate acode"],
			icon: "star_outline",
			info: strings["settings-info-main-rateapp"],
			category: categories.aboutAcode,
			chevron: true,
		},
	];

	/**
	 * Callback for settings page for handling click event
	 * @this {HTMLElement}
	 * @param {string} key
	 */
	async function callback(key, value) {
		switch (key) {
			case "account":
				Account();
				break;

			case "pluginServer":
				config.BASE_URL = value;
				break;

			case "anthropicApiKey":
				config.ANTHROPIC_API_KEY = value;
				break;

			case "openaiApiKey":
				config.OPENAI_API_KEY = value;
				break;

			case "geminiApiKey":
				config.GEMINI_API_KEY = value;
				break;

			case "app-settings":
			case "backup-restore":
			case "editor-settings":
			case "preview-settings":
			case "terminal-settings":
			case "lsp-settings":
				appSettings.uiSettings[key].show();
				break;

			case "theme":
				themeSetting();
				break;

			case "about":
				About();
				break;

			case "rateapp":
				rateBox();
				break;

			case "plugins":
				plugins();
				break;

			case "formatter":
				formatterSettings();
				break;

			case "editSettings": {
				actionStack.pop();
				openFile(settings.settingsFile);
				break;
			}

			case "reset":
				const confirmation = await confirm(
					strings.warning,
					strings["restore default settings"],
				);
				if (confirmation) {
					await appSettings.reset();
					location.reload();
				}
				break;

			default:
				break;
		}
	}

	const page = settingsPage(title, items, callback, undefined, {
		preserveOrder: true,
		pageClassName: "main-settings-page",
		listClassName: "main-settings-list",
	});
	page.show();

	appSettings.uiSettings["main-settings"] = page;

	const lazyPages = {
		"app-settings": otherSettings,
		"file-settings": filesSettings,
		"backup-restore": backupRestore,
		"editor-settings": editorSettings,
		"scroll-settings": scrollSettings,
		"search-settings": searchSettings,
		"preview-settings": previewSettings,
		"terminal-settings": terminalSettings,
		"lsp-settings": lspSettings,
	};

	const instantiated = {};

	for (const [key, initializer] of Object.entries(lazyPages)) {
		delete appSettings.uiSettings[key];
		Object.defineProperty(appSettings.uiSettings, key, {
			get() {
				if (!(key in instantiated)) {
					instantiated[key] = initializer();
					Object.defineProperty(appSettings.uiSettings, key, {
						value: instantiated[key],
						writable: true,
						configurable: true,
						enumerable: true,
					});
				}
				return instantiated[key];
			},
			set(val) {
				instantiated[key] = val;
				Object.defineProperty(appSettings.uiSettings, key, {
					value: val,
					writable: true,
					configurable: true,
					enumerable: true,
				});
			},
			configurable: true,
			enumerable: false,
		});
	}
}
