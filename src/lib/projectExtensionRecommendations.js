import fsOperation from "fileSystem";
import Url from "utils/Url";
import notificationManager from "./notificationManager";
import appSettings from "./settings";

const notifiedFolders = new Set();

/** Checked in order; first matching dependency wins so frameworks (react, vue, ...)
 * take priority over the generic "node" fallback. */
const PACKAGE_JSON_RULES = [
	{ dep: "next", keyword: "nextjs", label: "Next.js" },
	{ dep: "react", keyword: "react", label: "React" },
	{ dep: "vue", keyword: "vue", label: "Vue" },
	{ dep: "@angular/core", keyword: "angular", label: "Angular" },
	{ dep: "svelte", keyword: "svelte", label: "Svelte" },
	{ dep: "express", keyword: "node", label: "Node.js/Express" },
	{ dep: "tailwindcss", keyword: "tailwindcss", label: "Tailwind CSS" },
];

const MARKER_RULES = [
	{ file: "requirements.txt", keyword: "python", label: "Python" },
	{ file: "pyproject.toml", keyword: "python", label: "Python" },
	{ file: "Pipfile", keyword: "python", label: "Python" },
	{ file: "build.gradle", keyword: "android", label: "Android/Gradle" },
	{ file: "build.gradle.kts", keyword: "android", label: "Android/Gradle" },
	{ file: "pom.xml", keyword: "java", label: "Java/Maven" },
	{ file: "Cargo.toml", keyword: "rust", label: "Rust" },
	{ file: "go.mod", keyword: "go", label: "Go" },
	{ file: "composer.json", keyword: "php", label: "PHP" },
	{ file: "Gemfile", keyword: "ruby", label: "Ruby" },
	{ file: "CMakeLists.txt", keyword: "cpp", label: "C/C++" },
];

async function detectFromPackageJson(folderUrl, fileNames) {
	if (!fileNames.has("package.json")) return null;

	try {
		const content = await fsOperation(
			Url.join(folderUrl, "package.json"),
		).readFile("utf8");
		const pkg = JSON.parse(content);
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		for (const rule of PACKAGE_JSON_RULES) {
			if (rule.dep in deps) return rule;
		}
		return { keyword: "node", label: "Node.js" };
	} catch {
		return null;
	}
}

async function openExtensions(keyword) {
	const { openWithSearch } = await import("sidebarApps/extensions");
	openWithSearch(keyword);
}

function dedupeByKeyword(detections) {
	const seen = new Set();
	return detections.filter((detection) => {
		if (seen.has(detection.keyword)) return false;
		seen.add(detection.keyword);
		return true;
	});
}

async function scanFolder(folderUrl, folderName) {
	if (notifiedFolders.has(folderUrl)) return;
	notifiedFolders.add(folderUrl);

	let entries;
	try {
		entries = await fsOperation(folderUrl).lsDir();
	} catch {
		return;
	}

	const fileNames = new Set(
		entries.filter((entry) => !entry.isDirectory).map((entry) => entry.name),
	);

	const detections = [];
	const packageJsonMatch = await detectFromPackageJson(folderUrl, fileNames);
	if (packageJsonMatch) detections.push(packageJsonMatch);
	for (const rule of MARKER_RULES) {
		if (fileNames.has(rule.file)) detections.push(rule);
	}

	if (!detections.length) return;
	const unique = dedupeByKeyword(detections);
	const labels = unique.map((detection) => detection.label).join(", ");

	notificationManager.pushNotification({
		title: `Recommended extensions for ${folderName}`,
		message: `This project looks like ${labels}. Browse matching plugins from the marketplace?`,
		icon: "extension",
		type: "info",
		action: () => openExtensions(unique[0].keyword),
		actions: unique.map((detection) => ({
			text: detection.label,
			icon: "search",
			action: () => openExtensions(detection.keyword),
		})),
	});
}

/** Scans a newly opened project root for framework/language marker files
 * (package.json, requirements.txt, build.gradle, ...) and, once per folder per
 * session, suggests matching plugins from the marketplace - the project-wide
 * counterpart to languageModeRecommendations.js's per-file suggestions. */
export default function recommendProjectExtensions(folderUrl, folderName) {
	if (appSettings.value.recommendExtensions === false) return;

	void scanFolder(folderUrl, folderName).catch((error) => {
		console.warn(
			"Failed to scan project for extension recommendations.",
			error,
		);
	});
}
