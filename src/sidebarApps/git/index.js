import "./style.scss";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import prompt from "dialogs/prompt";
import select from "dialogs/select";
import gitService from "lib/gitService";

/**@type {HTMLElement} */
let container;
/**@type {HTMLElement} */
let $body;
let refreshing = false;

export default [
	"git", // icon
	"git", // id
	"Source Control", // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
];

const $header = (
	<div className="header">
		<div className="title">
			Source Control
			<span>
				<button
					type="button"
					className="icon-button"
					title="Refresh"
					onclick={() => refresh()}
				>
					<span className="icon refresh"></span>
				</button>
				<button
					type="button"
					className="icon-button"
					title="More actions"
					onclick={(e) => showMenu(e)}
				>
					<span className="icon more_vert"></span>
				</button>
			</span>
		</div>
	</div>
);

function initApp(el) {
	container = el;
	container.classList.add("git-panel");
	container.content = $header;
	$body = <div className="git-body scroll"></div>;
	container.append($body);
	Sidebar.on("show", onSelected);
	refresh();
}

function onSelected() {
	refresh();
}

function escapeHtml(str = "") {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function empty(message) {
	return <div className="empty-state">{message}</div>;
}

async function cloneRepository() {
	const url = await prompt("Repository URL", "", "url", {
		placeholder: "https://github.com/user/repo.git",
	});
	if (!url) return;

	loader.showTitleLoader();
	try {
		const result = await gitService.clone(url.trim());
		if (!result.androidUrl) {
			throw new Error("Could not resolve a location to open the clone.");
		}
		const { default: openFolder } = await import("lib/openFolder");
		openFolder(result.androidUrl, { name: result.folderName });
		toast(`Cloned ${result.folderName}`);
	} catch (error) {
		showOutput("Clone failed", String(error?.message || error));
	} finally {
		loader.removeTitleLoader();
		refresh();
	}
}

async function showMenu(e) {
	e?.stopPropagation();
	const project = gitService.getProject();

	const items = [["clone", "Clone Repository", "cloud_download"]];
	if (project) {
		items.push(
			["pull", "Pull", "arrow_downward"],
			["push", "Push", "arrow_upward"],
			["stageAll", "Stage All Changes", "add"],
			["log", "View History", "historyrestore"],
		);
	}

	const choice = await select("Source Control", items, true).catch(() => null);
	if (!choice) return;

	if (choice === "clone") {
		await cloneRepository();
		return;
	}

	if (!project) return;

	try {
		loader.showTitleLoader();
		if (choice === "pull") {
			const out = await gitService.pull(project.path);
			toast("Pull complete");
			if (out?.trim()) showOutput("Pull", out);
		} else if (choice === "push") {
			const out = await gitService.push(project.path);
			toast("Push complete");
			if (out?.trim()) showOutput("Push", out);
		} else if (choice === "stageAll") {
			await gitService.stageAll(project.path);
		} else if (choice === "log") {
			const out = await gitService.getLog(project.path);
			showOutput("History", out || "No commits yet.");
		}
	} catch (error) {
		showOutput("Error", String(error?.message || error));
	} finally {
		loader.removeTitleLoader();
		refresh();
	}
}

function showOutput(title, text) {
	alert(
		title,
		`<pre style="white-space:pre-wrap;word-break:break-word;font-family:monospace;font-size:0.85em;">${escapeHtml(text)}</pre>`,
	);
}

async function refresh() {
	if (refreshing) return;
	refreshing = true;
	try {
		await render();
	} finally {
		refreshing = false;
	}
}

async function render() {
	if (!$body) return;
	$body.textContent = "";

	const project = gitService.getProject();
	if (!project) {
		$body.append(
			<div className="empty-state">
				<p>Open a folder to use source control.</p>
				<button
					type="button"
					className="action-button"
					onclick={cloneRepository}
				>
					<span className="icon cloud_download"></span> Clone Repository
				</button>
			</div>,
		);
		return;
	}

	if (!project.path) {
		$body.append(
			empty(
				"This location isn't accessible from the built-in terminal, so Git isn't available here.",
			),
		);
		return;
	}

	const hasGit = await gitService.isGitInstalled();
	if (!hasGit) {
		$body.append(
			<div className="empty-state">
				<p>Git is not installed in the built-in terminal.</p>
				<button
					type="button"
					className="action-button"
					onclick={async () => {
						loader.showTitleLoader();
						try {
							await gitService.installGit();
							toast("Git installed");
						} catch (error) {
							toast(`Failed to install git: ${error?.message || error}`);
						} finally {
							loader.removeTitleLoader();
							refresh();
						}
					}}
				>
					Install Git
				</button>
			</div>,
		);
		return;
	}

	const isRepo = await gitService.isRepo(project.path);
	if (!isRepo) {
		$body.append(
			<div className="empty-state">
				<p>This folder is not a Git repository.</p>
				<button
					type="button"
					className="action-button"
					onclick={async () => {
						loader.showTitleLoader();
						try {
							await gitService.initRepo(project.path);
						} catch (error) {
							toast(`Failed to initialize: ${error?.message || error}`);
						} finally {
							loader.removeTitleLoader();
							refresh();
						}
					}}
				>
					Initialize Repository
				</button>
			</div>,
		);
		return;
	}

	const [branch, status] = await Promise.all([
		gitService.getBranch(project.path),
		gitService.getStatus(project.path),
	]);

	const $branch = (
		<div className="branch-row">
			<span className="icon git"></span>
			<span className="branch-name">{branch || "(no branch)"}</span>
		</div>
	);

	const $commitBox = (
		<div className="commit-box">
			<textarea
				className="commit-message"
				placeholder="Commit message"
				rows="2"
			></textarea>
			<button type="button" className="action-button commit-button">
				<span className="icon check"></span> Commit
			</button>
		</div>
	);

	const $commitMessage = $commitBox.get(".commit-message");
	const $commitButton = $commitBox.get(".commit-button");
	$commitButton.disabled = status.staged.length === 0;
	$commitButton.onclick = async () => {
		const message = $commitMessage.value.trim();
		if (!message) {
			toast("Enter a commit message");
			return;
		}
		loader.showTitleLoader();
		try {
			await gitService.commit(project.path, message);
			toast("Committed");
		} catch (error) {
			showOutput("Commit failed", String(error?.message || error));
		} finally {
			loader.removeTitleLoader();
			refresh();
		}
	};

	$body.append($branch, $commitBox);

	if (
		!status.staged.length &&
		!status.unstaged.length &&
		!status.untracked.length
	) {
		$body.append(empty("No changes."));
		return;
	}

	if (status.staged.length) {
		$body.append(
			renderSection("Staged Changes", status.staged, project.path, {
				staged: true,
				actionIcon: "remove",
				actionTitle: "Unstage",
				onAction: (file) => gitService.unstage(project.path, file),
			}),
		);
	}

	if (status.unstaged.length) {
		$body.append(
			renderSection("Changes", status.unstaged, project.path, {
				staged: false,
				actionIcon: "add",
				actionTitle: "Stage",
				onAction: (file) => gitService.stage(project.path, file),
				secondaryIcon: "undo",
				secondaryTitle: "Discard changes",
				onSecondary: async (file) => {
					const ok = await confirm(
						"Discard changes",
						`Discard changes in ${file}? This cannot be undone.`,
					);
					if (!ok) return;
					await gitService.discard(project.path, file);
				},
			}),
		);
	}

	if (status.untracked.length) {
		$body.append(
			renderSection("Untracked Files", status.untracked, project.path, {
				staged: false,
				actionIcon: "add",
				actionTitle: "Stage",
				onAction: (file) => gitService.stage(project.path, file),
			}),
		);
	}
}

function renderSection(title, files, path, opts) {
	const $section = (
		<div className="git-section">
			<div className="section-title">
				{title} <span className="count">{files.length}</span>
			</div>
			<div className="file-list"></div>
		</div>
	);
	const $list = $section.get(".file-list");

	files.forEach(({ file, status }) => {
		const $row = (
			<div className="file-row">
				<span className={`status-badge status-${status}`}>{status}</span>
				<span className="file-name" title={file}>
					{file}
				</span>
				<span className="row-actions">
					{opts.onSecondary && (
						<button
							type="button"
							className="icon-button"
							title={opts.secondaryTitle}
							onclick={async (e) => {
								e.stopPropagation();
								loader.showTitleLoader();
								try {
									await opts.onSecondary(file);
								} catch (error) {
									toast(String(error?.message || error));
								} finally {
									loader.removeTitleLoader();
									refresh();
								}
							}}
						>
							<span className={`icon ${opts.secondaryIcon}`}></span>
						</button>
					)}
					<button
						type="button"
						className="icon-button"
						title={opts.actionTitle}
						onclick={async (e) => {
							e.stopPropagation();
							loader.showTitleLoader();
							try {
								await opts.onAction(file);
							} catch (error) {
								toast(String(error?.message || error));
							} finally {
								loader.removeTitleLoader();
								refresh();
							}
						}}
					>
						<span className={`icon ${opts.actionIcon}`}></span>
					</button>
				</span>
			</div>
		);

		$row.onclick = async () => {
			try {
				const diff = await gitService.getDiff(path, file, opts.staged);
				showOutput(file, diff?.trim() || "No changes to display.");
			} catch (error) {
				toast(String(error?.message || error));
			}
		};

		$list.append($row);
	});

	return $section;
}
