import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import { loadFileBrowser } from "lib/lazyImports";
import appSettings from "lib/settings";

const BYTES_PER_ROW = 16;
const ROWS_PER_PAGE = 512; // 8192 bytes per "Load more"

export default function HexViewer() {
	let bytes = null;
	let fileName = "";
	let rowsShown = 0;

	const $page = Page("Hex Viewer");
	const $meta = <div className="hex-meta">No file selected.</div>;
	const $table = <div className="hex-table"></div>;
	const $loadMoreButton = (
		<button type="button" className="action-button hex-load-more">
			Load more
		</button>
	);
	const $chooseButton = (
		<button type="button" className="action-button" data-action="choose">
			Choose File
		</button>
	);

	const $content = (
		<div id="hex-viewer">
			{$chooseButton}
			{$meta}
			{$table}
			{$loadMoreButton}
		</div>
	);

	$loadMoreButton.hidden = true;
	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("hex-viewer");
	};
	actionStack.push({ id: "hex-viewer", action: $page.hide });

	$chooseButton.addEventListener("click", chooseFile);
	$loadMoreButton.addEventListener("click", () =>
		renderRows(rowsShown + ROWS_PER_PAGE),
	);

	chooseFile();

	async function chooseFile() {
		try {
			const FileBrowser = await loadFileBrowser();
			const res = await FileBrowser("file", "Select a file to view as hex");
			if (!res?.url) return;
			await loadFile(res.url, res.name || res.url);
		} catch (error) {
			// user cancelled the picker
		}
	}

	async function loadFile(url, name) {
		$meta.textContent = "Loading...";
		$table.textContent = "";
		$loadMoreButton.hidden = true;

		try {
			const stats = await fsOperation(url).stat();
			const sizeBytes = stats?.length ?? stats?.size ?? 0;
			if (sizeBytes * 0.000001 > appSettings.value.maxFileSize) {
				toast(`File too large (max ${appSettings.value.maxFileSize}MB).`);
				$meta.textContent = "No file selected.";
				return;
			}

			const data = await fsOperation(url).readFile();
			bytes = new Uint8Array(data);
			fileName = name;
			rowsShown = 0;
			$meta.textContent = `${fileName} - ${bytes.length.toLocaleString()} bytes`;
			renderRows(ROWS_PER_PAGE);
		} catch (error) {
			toast(`Couldn't read file: ${error?.message || error}`);
			$meta.textContent = "No file selected.";
		}
	}

	function renderRows(upToRow) {
		if (!bytes) return;
		const totalRows = Math.ceil(bytes.length / BYTES_PER_ROW);
		const targetRow = Math.min(upToRow, totalRows);

		const rows = [];
		for (let row = rowsShown; row < targetRow; row++) {
			const start = row * BYTES_PER_ROW;
			const chunk = bytes.subarray(start, start + BYTES_PER_ROW);

			let hexPart = "";
			let asciiPart = "";
			for (let i = 0; i < BYTES_PER_ROW; i++) {
				if (i < chunk.length) {
					const byte = chunk[i];
					hexPart += `${byte.toString(16).padStart(2, "0")} `;
					asciiPart +=
						byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
				} else {
					hexPart += "   ";
				}
				if (i === 7) hexPart += " ";
			}

			rows.push(
				<div className="hex-row">
					<span className="hex-offset">
						{start.toString(16).padStart(8, "0")}
					</span>
					<span className="hex-bytes">{hexPart}</span>
					<span className="hex-ascii">{asciiPart}</span>
				</div>,
			);
		}

		$table.append(...rows);
		rowsShown = targetRow;
		$loadMoreButton.hidden = rowsShown >= totalRows;
	}
}
