import fsOperation from "fileSystem";
import toast from "components/toast";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import Url from "utils/Url";
import gitService from "./gitService";

const notifiedFolders = new Set();

async function exists(url) {
	try {
		return await fsOperation(url).exists();
	} catch {
		return false;
	}
}

/** Detects install-able dependency manifests whose install output directory
 * is missing, and returns one candidate {label, command} per ecosystem
 * found. Gradle/Cargo are deliberately excluded - they resolve dependencies
 * automatically at build time, with no separate "install" step to run. */
async function detectMissingInstalls(folderUrl, fileNames) {
	const candidates = [];

	if (fileNames.has("package.json")) {
		const hasNodeModules = await exists(Url.join(folderUrl, "node_modules"));
		if (!hasNodeModules) {
			let command = "npm install";
			if (fileNames.has("pnpm-lock.yaml")) command = "pnpm install";
			else if (fileNames.has("yarn.lock")) command = "yarn install";
			candidates.push({ label: "Node.js dependencies", command });
		}
	}

	if (fileNames.has("requirements.txt")) {
		candidates.push({
			label: "Python dependencies",
			command: "pip install -r requirements.txt",
		});
	}

	if (fileNames.has("composer.json")) {
		const hasVendor = await exists(Url.join(folderUrl, "vendor"));
		if (!hasVendor) {
			candidates.push({
				label: "PHP dependencies (Composer)",
				command: "composer install",
			});
		}
	}

	if (fileNames.has("go.mod")) {
		candidates.push({ label: "Go modules", command: "go mod download" });
	}

	return candidates;
}

function escapeHtml(str = "") {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function shellEscape(str = "") {
	return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

async function runInstall(project, candidate) {
	loader.showTitleLoader();
	try {
		const output = await window.Executor.execute(
			`cd ${shellEscape(project.path)} && ${candidate.command} 2>&1`,
			true,
		);
		toast(`${candidate.label}: install finished.`);
		alert(
			candidate.label,
			`<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:0.85em;">${escapeHtml(output || "(no output)")}</pre>`,
		);
	} catch (error) {
		toast(`${candidate.label}: install failed - ${error?.message || error}`);
	} finally {
		loader.removeTitleLoader();
	}
}

async function scanFolder(folderUrl, folderName) {
	if (notifiedFolders.has(folderUrl)) return;
	notifiedFolders.add(folderUrl);

	if (typeof window.Executor?.execute !== "function") return;

	const project = gitService.getProject();
	if (!project?.path || project.url !== folderUrl) return;

	let entries;
	try {
		entries = await fsOperation(folderUrl).lsDir();
	} catch {
		return;
	}
	const fileNames = new Set(
		entries.filter((entry) => !entry.isDirectory).map((entry) => entry.name),
	);

	const candidates = await detectMissingInstalls(folderUrl, fileNames);
	for (const candidate of candidates) {
		const proceed = await confirm(
			"Install dependencies?",
			`${folderName} looks like it needs ${candidate.label}. Run "${candidate.command}" now in the built-in terminal?`,
		);
		if (proceed) await runInstall(project, candidate);
	}
}

/** Scans a newly opened project root for dependency manifests
 * (package.json, requirements.txt, composer.json, go.mod) whose packages
 * don't look installed yet, and offers to run the install command in the
 * terminal sandbox. */
export default function recommendDependencyInstall(folderUrl, folderName) {
	void scanFolder(folderUrl, folderName).catch((error) => {
		console.warn("Failed to check for missing project dependencies.", error);
	});
}
