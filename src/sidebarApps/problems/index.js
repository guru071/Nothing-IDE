import "./style.scss";
import Sidebar from "components/sidebar";
import {
	collectFileProblems,
	getIconForProblemType,
} from "lib/collectFileProblems";
import helpers from "utils/helpers";

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement} */
let $list;

export default [
	"document-error", // icon
	"problems", // id
	"Problems", // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
];

function initApp(el) {
	container = el;
	container.classList.add("problems-panel");

	$list = <div className="problems-list scroll"></div>;
	container.append($list);
	container.addEventListener("click", clickHandler);

	const debouncedRefresh = helpers.debounce(refresh, 400);
	editorManager.on(
		["switch-file", "remove-file", "rename-file", "new-file"],
		refresh,
	);
	editorManager.on("editor-state-changed", debouncedRefresh);
	editorManager.on("file-content-changed", debouncedRefresh);
	Sidebar.on("show", onSelected);

	refresh();
}

function onSelected() {
	refresh();
}

function clickHandler(e) {
	const $target = e.target.closest("[data-file-id]");
	if (!$target) return;

	const { fileId } = $target.dataset;
	const row = Number.parseInt($target.dataset.row, 10);
	const column = Number.parseInt($target.dataset.column, 10);

	editorManager.switchFile(fileId);
	editorManager.editor.gotoLine(row + 1, column);
	setTimeout(() => editorManager.editor.focus(), 100);
}

function refresh() {
	if (!container) return;

	const groups = editorManager.files
		.filter((file) => file.type === "editor")
		.map((file) => ({ file, problems: collectFileProblems(file) }))
		.filter((group) => group.problems.length);

	if (!groups.length) {
		$list.textContent = "";
		$list.append(<div className="problems-empty">No problems found.</div>);
		return;
	}

	$list.textContent = "";
	$list.append(
		...groups.map(({ file, problems }) => (
			<details open="true" className="problem-group">
				<summary>
					{file.name} ({problems.length})
				</summary>
				<div>
					{problems.map((problem) => (
						<div
							className="problem-row"
							data-file-id={file.id}
							data-row={problem.row}
							data-column={problem.column}
						>
							<span
								className={`icon ${getIconForProblemType(problem.type)}`}
								data-type={problem.type}
							></span>
							<span className="problem-text">{problem.text}</span>
							<span className="problem-pos">
								{problem.row + 1}:{problem.column + 1}
							</span>
						</div>
					))}
				</div>
			</details>
		)),
	);
}
