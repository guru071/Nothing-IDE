import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import { loadFileBrowser } from "lib/lazyImports";
import Url from "utils/Url";

const FORMATS = ["json", "xml", "csv"];

/**
 * A collapsible tree view for JSON/XML, and a table view for CSV - an
 * alternative to reading raw text for structured data files.
 */
export default function DataViewer() {
	const $page = Page("Data Viewer");
	const $meta = <div className="dv-meta">No file selected.</div>;
	const $formatSelect = (
		<select className="dv-format">
			{FORMATS.map((format) => (
				<option value={format}>{format.toUpperCase()}</option>
			))}
		</select>
	);
	const $chooseButton = (
		<button type="button" className="action-button" data-action="choose">
			Choose File
		</button>
	);
	const $view = <div className="dv-view"></div>;

	const $content = (
		<div id="data-viewer">
			<div className="dv-toolbar">
				{$chooseButton}
				{$formatSelect}
			</div>
			{$meta}
			{$view}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("data-viewer");
	};
	actionStack.push({ id: "data-viewer", action: $page.hide });

	let currentText = "";

	$chooseButton.addEventListener("click", chooseFile);
	$formatSelect.addEventListener("change", () => render(currentText));

	chooseFile();

	async function chooseFile() {
		try {
			const FileBrowser = await loadFileBrowser();
			const res = await FileBrowser("file", "Select a JSON, XML, or CSV file");
			if (!res?.url) return;
			await loadFile(res.url, res.name || res.url);
		} catch (error) {
			// user cancelled the picker
		}
	}

	async function loadFile(url, name) {
		$meta.textContent = "Loading...";
		$view.textContent = "";

		try {
			currentText = await fsOperation(url).readFile("utf8");
			$meta.textContent = name;

			const ext = Url.extname(name).replace(".", "").toLowerCase();
			if (FORMATS.includes(ext)) $formatSelect.value = ext;

			render(currentText);
		} catch (error) {
			toast(`Couldn't read file: ${error?.message || error}`);
			$meta.textContent = "No file selected.";
		}
	}

	function render(text) {
		$view.textContent = "";
		if (!text) return;

		const format = $formatSelect.value;
		try {
			if (format === "json") {
				$view.append(renderJsonNode(JSON.parse(text), null));
			} else if (format === "xml") {
				$view.append(renderXml(text));
			} else {
				$view.append(renderCsv(text));
			}
		} catch (error) {
			$view.append(
				<div className="dv-error">
					Couldn't parse as {format.toUpperCase()}: {error.message}
				</div>,
			);
		}
	}
}

function renderJsonNode(value, key) {
	if (value === null) return jsonLeaf(key, "null", "dv-null");
	if (Array.isArray(value)) {
		return jsonBranch(
			key,
			`Array(${value.length})`,
			value.map((item, i) => renderJsonNode(item, i)),
		);
	}
	if (typeof value === "object") {
		const entries = Object.entries(value);
		return jsonBranch(
			key,
			`Object(${entries.length})`,
			entries.map(([k, v]) => renderJsonNode(v, k)),
		);
	}
	if (typeof value === "string")
		return jsonLeaf(key, `"${value}"`, "dv-string");
	if (typeof value === "number")
		return jsonLeaf(key, String(value), "dv-number");
	if (typeof value === "boolean")
		return jsonLeaf(key, String(value), "dv-boolean");
	return jsonLeaf(key, String(value), "");
}

function jsonBranch(key, label, children) {
	return (
		<details open="true" className="dv-node">
			<summary>
				{key !== null && <span className="dv-key">{key}: </span>}
				<span className="dv-type">{label}</span>
			</summary>
			<div className="dv-children">{children}</div>
		</details>
	);
}

function jsonLeaf(key, text, valueClass) {
	return (
		<div className="dv-leaf">
			{key !== null && <span className="dv-key">{key}: </span>}
			<span className={valueClass}>{text}</span>
		</div>
	);
}

function renderXml(text) {
	const doc = new DOMParser().parseFromString(text, "application/xml");
	const errorNode = doc.querySelector("parsererror");
	if (errorNode) throw new Error(errorNode.textContent.slice(0, 200));
	return renderXmlNode(doc.documentElement);
}

function renderXmlNode(el) {
	const childElements = Array.from(el.children);
	const textContent = Array.from(el.childNodes)
		.filter((n) => n.nodeType === Node.TEXT_NODE)
		.map((n) => n.textContent.trim())
		.filter(Boolean)
		.join(" ");

	const attrs = Array.from(el.attributes || []);

	if (!childElements.length) {
		return (
			<div className="dv-leaf">
				<span className="dv-tag">&lt;{el.tagName}&gt;</span>
				{attrs.map((attr) => (
					<span className="dv-attr">
						{" "}
						{attr.name}="{attr.value}"
					</span>
				))}
				{textContent && <span className="dv-string"> {textContent}</span>}
			</div>
		);
	}

	return (
		<details open="true" className="dv-node">
			<summary>
				<span className="dv-tag">
					&lt;{el.tagName}&gt; ({childElements.length})
				</span>
				{attrs.map((attr) => (
					<span className="dv-attr">
						{" "}
						{attr.name}="{attr.value}"
					</span>
				))}
			</summary>
			<div className="dv-children">
				{childElements.map((child) => renderXmlNode(child))}
			</div>
		</details>
	);
}

function parseCsvRows(text) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (inQuotes) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n" || char === "\r") {
			if (char === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			rows.push(row);
			row = [];
		} else {
			field += char;
		}
	}
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => r.length > 1 || r[0] !== "");
}

function renderCsv(text) {
	const rows = parseCsvRows(text);
	if (!rows.length) return <div className="dv-error">Empty file.</div>;

	const [header, ...body] = rows;
	return (
		<div className="dv-csv-wrap">
			<table className="dv-csv-table">
				<thead>
					<tr>
						{header.map((cell) => (
							<th>{cell}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{body.map((row) => (
						<tr>
							{row.map((cell) => (
								<td>{cell}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<div className="dv-csv-count">{body.length} rows</div>
		</div>
	);
}
