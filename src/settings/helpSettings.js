import settingsPage from "components/settingsPage";
import config from "lib/config";

async function openUrl(url) {
	if (window.cordova?.exec) {
		const { default: customTab } = await import("lib/customTab");
		await customTab(url);
		return;
	}
	window.open(url, "_blank", "noopener,noreferrer");
}

export default function help() {
	const title = strings.help;
	const categories = {
		guide: "Guide",
		community: "Community",
	};

	const items = [
		{
			key: "guide-git",
			text: "Source Control (Git)",
			icon: "git",
			info: "Stage, commit, push, pull, and clone repositories from the Source Control panel in the sidebar. Needs the Terminal feature installed.",
			category: categories.guide,
		},
		{
			key: "guide-terminal",
			text: "Terminal",
			icon: "terminal",
			info: "A real Alpine Linux sandbox with its own package manager (apk). Install it once from the sidebar, then run any Linux command - git, python, node, gcc, and more.",
			category: categories.guide,
		},
		{
			key: "guide-ai-agent",
			text: "AI Agent",
			icon: "chat_bubble",
			info: "Chat with an AI that can read/write files and run shell commands in your open project (asks before every write or command). Toggle Online (needs your own API key from a supported provider) or Offline (a small model running fully on-device, no internet, conversation only).",
			category: categories.guide,
		},
		{
			key: "guide-plugins",
			text: "Plugins & Themes",
			icon: "extension",
			info: "Browse and install plugins/themes from the Extensions panel. Everything here is free.",
			category: categories.guide,
		},
		{
			key: "guide-dependencies",
			text: "Auto-Install Dependencies",
			icon: "cloud_download",
			info: "Opening a project with a package.json, requirements.txt, composer.json, or go.mod that hasn't been installed yet offers to run the install command for you in the terminal.",
			category: categories.guide,
		},
		{
			key: "guide-outline-problems",
			text: "Outline & Problems Panels",
			icon: "document-code",
			info: "Two sidebar panels next to Files/Search/Git: Outline shows the current file's symbols (from the language server), Problems lists diagnostics across all open files. Both update live and jump to the source on tap.",
			category: categories.guide,
		},
		{
			key: "app-logs",
			text: "View App Logs",
			icon: "bug_report",
			info: "This app's own runtime log - useful when reporting a bug. Filter by level, share, or clear.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "wireless-debug",
			text: "Wireless Debugging",
			icon: "terminal",
			info: "Connect a computer to this device over Wi-Fi for ADB, without a USB cable.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "regex-playground",
			text: "Regex Playground",
			icon: "text-search",
			info: "Test a regular expression against sample text with live match highlighting and capture groups.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "color-picker",
			text: "Color Picker",
			icon: "colorize",
			info: "Pick a color and convert between HEX/RGB/HSL, or insert it straight into the current file.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "rest-client",
			text: "REST Client",
			icon: "cloud",
			info: "Send HTTP requests (any method, custom headers/body) and inspect the response, with request history.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "hex-viewer",
			text: "Hex Viewer",
			icon: "code",
			info: "View any file's raw bytes as a hex + ASCII dump.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "data-viewer",
			text: "Data Viewer",
			icon: "document-code",
			info: "View JSON as a collapsible tree, XML as an element tree, or CSV as a table, instead of raw text.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "clipboard-history",
			text: "Clipboard History",
			icon: "copy",
			info: "The last 50 things you've copied or cut anywhere in the app, tap to copy again.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "apk-analyzer",
			text: "APK Analyzer",
			icon: "android",
			info: "Inspect any APK's package name, version, SDK range, permissions, component counts, and a size breakdown by category.",
			category: categories.guide,
			chevron: true,
		},
		{
			key: "github",
			text: "GitHub Repository",
			icon: "github",
			info: "View the source code, star the project, or track changes.",
			category: categories.community,
			chevron: true,
		},
		{
			key: "report-issue",
			text: "Report an Issue",
			icon: "bug_report",
			info: "Found a bug or have a feature request? Open an issue on GitHub.",
			category: categories.community,
			chevron: true,
		},
		{
			key: "website",
			text: "GOAT'ECH Website",
			icon: "public",
			info: "goatech.tech",
			category: categories.community,
			chevron: true,
		},
	];

	function callback(key) {
		switch (key) {
			case "app-logs":
				acode.exec("open", "log_viewer");
				break;
			case "wireless-debug":
				acode.exec("open", "wireless_debug");
				break;
			case "regex-playground":
				acode.exec("open", "regex_playground");
				break;
			case "color-picker":
				acode.exec("open", "color_picker");
				break;
			case "rest-client":
				acode.exec("open", "rest_client");
				break;
			case "hex-viewer":
				acode.exec("open", "hex_viewer");
				break;
			case "data-viewer":
				acode.exec("open", "data_viewer");
				break;
			case "clipboard-history":
				acode.exec("open", "clipboard_history");
				break;
			case "apk-analyzer":
				acode.exec("open", "apk_analyzer");
				break;
			case "github":
				openUrl(config.GITHUB_URL);
				break;
			case "report-issue":
				openUrl(`${config.GITHUB_URL}/issues/new`);
				break;
			case "website":
				openUrl("https://goatech.tech");
				break;
			default:
				break;
		}
	}

	const page = settingsPage(title, items, callback, "separate", {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		groupByDefault: true,
	});
	page.show();
}
