import "./style.scss";
import {
	fetchDocumentSymbols,
	getSymbolKindAbbreviation,
	getSymbolKindName,
	navigateToSymbol,
	supportsDocumentSymbols,
} from "cm/lsp";
import Sidebar from "components/sidebar";
import helpers from "utils/helpers";

/** @type {HTMLElement} */
let container;
/** @type {HTMLElement} */
let $list;
let refreshToken = 0;

export default [
	"document-code", // icon
	"outline", // id
	"Outline", // title
	initApp, // init function
	false, // prepend
	onSelected, // onSelected function
];

function initApp(el) {
	container = el;
	container.classList.add("outline-panel");

	$list = <div className="outline-list scroll"></div>;
	container.append($list);
	container.addEventListener("click", clickHandler);

	const debouncedRefresh = helpers.debounce(refresh, 400);
	editorManager.on("switch-file", refresh);
	editorManager.on("editor-state-changed", debouncedRefresh);
	editorManager.on(["remove-file", "rename-file"], refresh);
	Sidebar.on("show", onSelected);

	refresh();
}

function onSelected() {
	refresh();
}

function clickHandler(e) {
	const $target = e.target.closest("[data-line]");
	if (!$target) return;
	const { editor } = editorManager;
	if (!editor) return;

	const line = Number.parseInt($target.dataset.line, 10);
	const character = Number.parseInt($target.dataset.character, 10);
	navigateToSymbol(editor, { line, character });
}

function setMessage(text) {
	$list.textContent = "";
	$list.append(<div className="outline-empty">{text}</div>);
}

async function refresh() {
	if (!container) return;
	const token = ++refreshToken;

	const { activeFile, editor } = editorManager;
	if (!activeFile || activeFile.type !== "editor" || !editor) {
		setMessage("Open a file to see its outline.");
		return;
	}

	if (!supportsDocumentSymbols(editor)) {
		setMessage("No language server is providing symbols for this file.");
		return;
	}

	const symbols = await fetchDocumentSymbols(editor);
	if (token !== refreshToken) return; // a newer refresh has since started

	if (!symbols) {
		setMessage("Couldn't load symbols for this file.");
		return;
	}
	if (!symbols.length) {
		setMessage("No symbols found in this file.");
		return;
	}

	const rows = flatten(symbols);
	$list.textContent = "";
	$list.append(
		...rows.map((symbol) => {
			const kindClass = `kind-${getSymbolKindName(symbol.kind).toLowerCase()}`;
			return (
				<div
					className="outline-row"
					data-line={symbol.selectionRange.startLine}
					data-character={symbol.selectionRange.startCharacter}
					style={{ paddingLeft: `${10 + symbol.depth * 14}px` }}
				>
					<span className={`outline-kind ${kindClass}`}>
						{getSymbolKindAbbreviation(symbol.kind)}
					</span>
					<span className="outline-name">{symbol.name}</span>
					{symbol.detail && (
						<span className="outline-detail">{symbol.detail}</span>
					)}
				</div>
			);
		}),
	);
}

function flatten(symbols, depth = 0, out = []) {
	for (const symbol of symbols) {
		out.push({ ...symbol, depth });
		if (symbol.children?.length) flatten(symbol.children, depth + 1, out);
	}
	return out;
}
