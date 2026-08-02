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
