import "./style.scss";
import Page from "components/page";
import actionStack from "lib/actionStack";
import {
	collectFileProblems,
	getIconForProblemType,
} from "lib/collectFileProblems";
import EditorFile from "lib/editorFile";
import { hideAd } from "lib/startAd";
import helpers from "utils/helpers";

export default function Problems() {
	const $page = Page(strings["problems"]);
	/**@type {EditorFile[]} */
	const files = editorManager.files;
	const $content = <div id="problems"></div>;

	files.forEach((file) => {
		if (file.type !== "editor") return;
		const annotations = collectFileProblems(file);
		if (!annotations.length) return;

		const title = `${file.name} (${annotations.length})`;
		$content.append(
			<details open="true" className="single-file">
				<summary>{title}</summary>
				<div className="problems">
					{annotations.map((annotation) => {
						const { type, text, row, column } = annotation;
						const icon = getIconForProblemType(type);

						return (
							<div
								className="problem"
								data-action="goto"
								data-file-id={file.id}
								annotation={annotation}
							>
								<span className={`icon ${icon}`}></span>
								<span data-type={type} className="problem-message">
									{text}
								</span>
								<span className="problem-line">
									{row + 1}:{column + 1}
								</span>
							</div>
						);
					})}
				</div>
			</details>,
		);
	});

	$content.addEventListener("click", clickHandler);
	$page.body = $content;
	app.append($page);
	helpers.showAd();

	$page.onhide = function () {
		hideAd();
		actionStack.remove("problems");
	};

	actionStack.push({
		id: "problems",
		action: $page.hide,
	});

	/**
	 * Click handler for problems page
	 * @param {MouseEvent} e
	 */
	function clickHandler(e) {
		const $target = e.target.closest("[data-action='goto']");
		if (!$target) return;
		const { action } = $target.dataset;

		if (action === "goto") {
			const { fileId } = $target.dataset;
			const annotation = $target.annotation;
			if (!annotation) return;
			const row = normalizeIndex(annotation.row);
			const column = normalizeIndex(annotation.column);

			editorManager.switchFile(fileId);
			editorManager.editor.gotoLine(row + 1, column);
			$page.hide();

			setTimeout(() => {
				editorManager.editor.focus();
			}, 100);
		}
	}
}
