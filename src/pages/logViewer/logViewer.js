import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import actionStack from "lib/actionStack";
import logger from "lib/logger";

const LOG_LINE_RE = /^\[(.*?)\]\s*\[(\w+)\]\s*([\s\S]*)$/;
const LEVELS = ["all", "error", "warn", "info", "debug"];

/**
 * A real viewer for this app's own runtime log (see lib/logger.js) - not a
 * full Android system logcat, which the app has no permission to read past
 * its own process. Shows what it can actually show: this app's own leveled
 * log entries, with filtering, refresh, share, and clear.
 */
export default function LogViewer() {
	let currentLevel = "all";
	let rawEntries = [];

	const $page = Page(strings["log viewer"] || "Log Viewer");
	const $toolbar = (
		<div className="log-toolbar">
			{LEVELS.map((level) => (
				<button
					type="button"
					className={`log-filter${level === currentLevel ? " active" : ""}`}
					data-level={level}
				>
					{level}
				</button>
			))}
			<span className="log-toolbar-spacer"></span>
			<button type="button" data-action="refresh" title="Refresh">
				<span className="icon refresh"></span>
			</button>
			<button type="button" data-action="share" title="Share">
				<span className="icon share"></span>
			</button>
			<button type="button" data-action="clear" title="Clear">
				<span className="icon delete"></span>
			</button>
		</div>
	);
	const $list = <div className="log-list scroll"></div>;
	const $content = (
		<div id="log-viewer">
			{$toolbar}
			{$list}
		</div>
	);

	$toolbar.addEventListener("click", onToolbarClick);
	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("log-viewer");
	};
	actionStack.push({ id: "log-viewer", action: $page.hide });

	load();

	async function load() {
		$list.textContent = "";
		$list.append(<div className="log-loading">Loading...</div>);
		const content = await logger.readLogFile();
		rawEntries = parseEntries(content);
		render();
	}

	function parseEntries(content) {
		if (!content) return [];
		return content
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => {
				const match = line.match(LOG_LINE_RE);
				if (!match) return { timestamp: "", level: "info", message: line };
				const [, timestamp, level, message] = match;
				return { timestamp, level: level.toLowerCase(), message };
			})
			.reverse(); // newest first
	}

	function render() {
		const entries =
			currentLevel === "all"
				? rawEntries
				: rawEntries.filter((entry) => entry.level === currentLevel);

		$list.textContent = "";
		if (!entries.length) {
			$list.append(
				<div className="log-empty">
					{rawEntries.length
						? "No entries at this level."
						: "No logs recorded yet."}
				</div>,
			);
			return;
		}

		$list.append(
			...entries.map((entry) => (
				<div className="log-entry" data-level={entry.level}>
					<span className="log-level">{entry.level}</span>
					<span className="log-message">{entry.message}</span>
					{entry.timestamp && (
						<span className="log-timestamp">{entry.timestamp}</span>
					)}
				</div>
			)),
		);
	}

	async function onToolbarClick(e) {
		const $filterButton = e.target.closest("[data-level]");
		if ($filterButton) {
			currentLevel = $filterButton.dataset.level;
			for (const button of $toolbar.querySelectorAll("[data-level]")) {
				button.classList.toggle(
					"active",
					button.dataset.level === currentLevel,
				);
			}
			render();
			return;
		}

		const $actionButton = e.target.closest("[data-action]");
		if (!$actionButton) return;
		const { action } = $actionButton.dataset;

		if (action === "refresh") {
			await load();
			return;
		}

		if (action === "share") {
			if (!rawEntries.length) {
				toast("Nothing to share yet.");
				return;
			}
			const text = rawEntries
				.slice()
				.reverse()
				.map(
					(entry) => `[${entry.timestamp}] [${entry.level}] ${entry.message}`,
				)
				.join("\n");
			window.system?.shareText?.(text, () => {}, console.error);
			return;
		}

		if (action === "clear") {
			const confirmed = await confirm(
				strings.warning || "Warning",
				"Clear all recorded logs? This can't be undone.",
			);
			if (!confirmed) return;
			await logger.clearLogs();
			await load();
		}
	}
}
