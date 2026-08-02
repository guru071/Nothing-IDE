function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function csvField(value) {
	const str = value === null || value === undefined ? "" : String(value);
	if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
	return str;
}

function rowsToCsv(rows) {
	return rows.map((row) => row.map(csvField).join(",")).join("\n");
}

// Minimal RFC 4180-ish parser: handles quoted fields with embedded commas,
// newlines, and doubled-quote escapes.
function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += ch;
			}
			continue;
		}

		if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			row.push(field);
			field = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += ch;
		}
	}

	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function applyCsvTransform(view, transform) {
	const target = getTarget(view);
	const rows = parseCsv(target.text.trim());
	if (rows.length === 0) {
		window.toast?.("No CSV rows found.");
		return;
	}
	const result = rowsToCsv(transform(rows));
	view.dispatch({ changes: { from: target.from, to: target.to, insert: result } });
}

acode.setPluginInit("csv-column-tools", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "csv-sort-by-first-column",
		description: "CSV: Sort Data Rows by First Column",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyCsvTransform(view, ([header, ...data]) => [
				header,
				...data.slice().sort((a, b) => (a[0] || "").localeCompare(b[0] || "")),
			]);
		},
	});

	acode.addCommand({
		name: "csv-transpose",
		description: "CSV: Transpose Rows and Columns",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyCsvTransform(view, (rows) => {
				const cols = Math.max(...rows.map((r) => r.length));
				const result = [];
				for (let c = 0; c < cols; c++) {
					result.push(rows.map((row) => row[c] ?? ""));
				}
				return result;
			});
		},
	});

	acode.addCommand({
		name: "csv-remove-duplicate-rows",
		description: "CSV: Remove Duplicate Data Rows",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyCsvTransform(view, ([header, ...data]) => {
				const seen = new Set();
				const unique = data.filter((row) => {
					const key = JSON.stringify(row);
					if (seen.has(key)) return false;
					seen.add(key);
					return true;
				});
				return [header, ...unique];
			});
		},
	});
});

acode.setPluginUnmount("csv-column-tools", () => {
	acode.removeCommand("csv-sort-by-first-column");
	acode.removeCommand("csv-transpose");
	acode.removeCommand("csv-remove-duplicate-rows");
});
