import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import clipboardHistory from "lib/clipboardHistory";

export default function ClipboardHistory() {
	const $page = Page("Clipboard History");
	const $list = <div className="clip-list"></div>;
	const $clearButton = (
		<button type="button" className="icon-button" title="Clear all">
			<span className="icon delete_outline"></span>
		</button>
	);

	const $content = (
		<div id="clipboard-history">
			<div className="clip-toolbar">
				<span className="clip-hint">Tap an entry to copy it again.</span>
				{$clearButton}
			</div>
			{$list}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		unsubscribe();
		actionStack.remove("clipboard-history");
	};
	actionStack.push({ id: "clipboard-history", action: $page.hide });

	const unsubscribe = clipboardHistory.onChange(render);

	$clearButton.addEventListener("click", () => {
		clipboardHistory.clearHistory();
	});

	$list.addEventListener("click", (e) => {
		const $item = e.target.closest("[data-index]");
		if (!$item) return;
		const entries = clipboardHistory.getHistory();
		const entry = entries[Number.parseInt($item.dataset.index, 10)];
		if (!entry) return;
		navigator.clipboard?.writeText(entry.text).then(() => toast("Copied"));
	});

	render(clipboardHistory.getHistory());

	function render(entries) {
		$list.textContent = "";
		if (!entries.length) {
			$list.append(
				<div className="clip-empty">
					Nothing copied yet. Anything you copy or cut in the app shows up here.
				</div>,
			);
			return;
		}

		$list.append(
			...entries.map((entry, index) => (
				<div className="clip-item" data-index={index}>
					<div className="clip-text">{entry.text}</div>
					<div className="clip-time">{formatTime(entry.timestamp)}</div>
				</div>
			)),
		);
	}

	function formatTime(timestamp) {
		const diffSec = Math.round((Date.now() - timestamp) / 1000);
		if (diffSec < 60) return "just now";
		if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
		if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
		return new Date(timestamp).toLocaleDateString();
	}
}
