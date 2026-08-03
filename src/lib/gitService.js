import Url from "utils/Url";
import { addedFolder } from "./openFolder";
import { convertToProotPath, isTerminalAccessiblePath } from "./openFolder";

/**
 * Wraps a string in POSIX single-quotes, safe for embedding in a shell command.
 * @param {string} str
 * @returns {string}
 */
function sh(str = "") {
	return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

/**
 * Runs a one-shot command inside the Alpine terminal sandbox, `cd`-ed into `path`.
 * @param {string} path in-sandbox path (from convertToProotPath)
 * @param {string} command
 * @returns {Promise<string>} stdout
 */
function run(path, command) {
	return window.Executor.execute(`cd ${sh(path)} && ${command}`, true);
}

/**
 * Returns the current project's in-sandbox path, or null if no folder is open
 * or the open folder isn't reachable from the terminal sandbox.
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

async function isGitInstalled() {
	try {
		const out = await window.Executor.execute("command -v git", true);
		return Boolean(String(out || "").trim());
	} catch {
		return false;
	}
}

function installGit() {
	return window.Executor.execute(
		"apk add --no-cache git 2>&1 || sudo apk add --no-cache git 2>&1",
		true,
	);
}

async function isRepo(path) {
	try {
		const out = await run(path, "git rev-parse --is-inside-work-tree 2>&1");
		return String(out || "").trim() === "true";
	} catch {
		return false;
	}
}

function initRepo(path) {
	return run(path, "git init 2>&1");
}

async function getBranch(path) {
	try {
		const out = await run(
			path,
			"git rev-parse --abbrev-ref HEAD 2>/dev/null || echo ''",
		);
		return String(out || "").trim() || null;
	} catch {
		return null;
	}
}

/**
 * Parses `git status --porcelain=v1` output into staged/unstaged file lists.
 * @param {string} path
 * @returns {Promise<{staged: Array<{file:string,status:string}>, unstaged: Array<{file:string,status:string}>, untracked: Array<{file:string,status:string}>}>}
 */
async function getStatus(path) {
	const out = await run(path, "git status --porcelain=v1 2>&1");
	const staged = [];
	const unstaged = [];
	const untracked = [];

	String(out || "")
		.split("\n")
		.filter(Boolean)
		.forEach((line) => {
			const x = line[0];
			const y = line[1];
			let file = line.slice(3);
			// Renames look like "R  old -> new" — keep the new path.
			if (file.includes(" -> ")) {
				file = file.split(" -> ")[1];
			}
			if (x === "?" && y === "?") {
				untracked.push({ file, status: "untracked" });
				return;
			}
			if (x !== " " && x !== "?") {
				staged.push({ file, status: x });
			}
			if (y !== " " && y !== "?") {
				unstaged.push({ file, status: y });
			}
		});

	return { staged, unstaged, untracked };
}

function getDiff(path, file, staged = false) {
	return run(
		path,
		`git diff ${staged ? "--cached " : ""}-- ${sh(file)} 2>&1`,
	);
}

function stage(path, file) {
	return run(path, `git add -- ${sh(file)} 2>&1`);
}

function stageAll(path) {
	return run(path, "git add -A 2>&1");
}

function unstage(path, file) {
	return run(
		path,
		`git restore --staged -- ${sh(file)} 2>&1 || git reset -- ${sh(file)} 2>&1`,
	);
}

function discard(path, file) {
	return run(path, `git checkout -- ${sh(file)} 2>&1`);
}

function commit(path, message) {
	// Base64-encode the message to sidestep shell-quoting issues with
	// newlines/quotes in the commit message.
	const encoded = window.btoa(unescape(encodeURIComponent(message)));
	return run(
		path,
		`git commit -m "$(echo ${sh(encoded)} | base64 -d)" 2>&1`,
	);
}

function push(path) {
	return run(path, "git push 2>&1");
}

function pull(path) {
	return run(path, "git pull 2>&1");
}

function getLog(path, limit = 30) {
	return run(path, `git log --oneline -n ${Number(limit) || 30} 2>&1`);
}

/**
 * Guesses the folder name git would create for a clone URL, e.g.
 * "https://github.com/user/repo.git" -> "repo".
 * @param {string} url
 * @returns {string}
 */
function inferRepoName(url = "") {
	const trimmed = String(url).trim().replace(/\/+$/, "");
	const last = trimmed.split(/[\/:]/).pop() || "repo";
	return last.replace(/\.git$/, "") || "repo";
}

/**
 * The shared `/public` root - both the in-sandbox path (bind-mounted as
 * `/public` and `$HOME` inside Alpine) and its Android-side `file://` URL, so
 * a freshly cloned repo can be opened in the editor right after cloning.
 * @returns {{ prootPath: string, androidUrl: string }}
 */
function getSharedRoot() {
	return {
		prootPath: "/public",
		androidUrl: Url.join(cordova.file.dataDirectory, "public"),
	};
}

/**
 * Clones `url` into a new folder under the shared `/public` root (so the
 * result is immediately both terminal- and editor-accessible), unless
 * `intoPath` is given to clone alongside an already-open project instead.
 * @param {string} url
 * @param {string} [intoPath] in-sandbox path to clone into (defaults to `/public`)
 * @returns {Promise<{ folderName: string, prootPath: string, androidUrl: string, output: string }>}
 */
async function clone(url, intoPath) {
	const folderName = inferRepoName(url);
	const { prootPath: root, androidUrl: rootAndroidUrl } = getSharedRoot();
	const parentPath = intoPath || root;
	const output = await run(
		parentPath,
		`git clone -- ${sh(url)} ${sh(folderName)} 2>&1`,
	);
	const parentAndroidUrl = intoPath
		? null // caller already knows the Android url for an existing open folder
		: rootAndroidUrl;
	return {
		folderName,
		prootPath: Url.join(parentPath, folderName),
		androidUrl: parentAndroidUrl ? Url.join(parentAndroidUrl, folderName) : null,
		output,
	};
}

export default {
	getProject,
	isGitInstalled,
	installGit,
	isRepo,
	initRepo,
	getBranch,
	getStatus,
	getDiff,
	stage,
	stageAll,
	unstage,
	discard,
	commit,
	push,
	pull,
	getLog,
	clone,
	inferRepoName,
};
