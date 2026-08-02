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
	if (/[",\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

function jsonToCsv(data) {
	if (!Array.isArray(data) || data.length === 0) {
		throw new Error("expected a non-empty JSON array of objects");
	}

	const keys = [];
	for (const row of data) {
		for (const key of Object.keys(row)) {
			if (!keys.includes(key)) keys.push(key);
		}
	}

	const lines = [keys.map(csvField).join(",")];
	for (const row of data) {
		lines.push(keys.map((key) => csvField(row[key])).join(","));
	}
	return lines.join("\n");
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

function csvToJson(text) {
	const rows = parseCsv(text.trim());
	if (rows.length === 0) return [];
	const [header, ...dataRows] = rows;
	return dataRows.map((row) => {
		const obj = {};
		header.forEach((key, i) => {
			obj[key] = row[i] ?? "";
		});
		return obj;
	});
}

acode.setPluginInit("json-csv-converter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "json-to-csv",
		description: "JSON/CSV: Convert JSON Array to CSV",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			try {
				const data = JSON.parse(target.text);
				const csv = jsonToCsv(data);
				view.dispatch({ changes: { from: target.from, to: target.to, insert: csv } });
			} catch (err) {
				window.toast?.(`Could not convert: ${err.message}`);
			}
		},
	});

	acode.addCommand({
		name: "csv-to-json",
		description: "JSON/CSV: Convert CSV to JSON Array",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			try {
				const data = csvToJson(target.text);
				view.dispatch({
					changes: { from: target.from, to: target.to, insert: JSON.stringify(data, null, 2) },
				});
			} catch (err) {
				window.toast?.(`Could not convert: ${err.message}`);
			}
		},
	});
});

acode.setPluginUnmount("json-csv-converter", () => {
	acode.removeCommand("json-to-csv");
	acode.removeCommand("csv-to-json");
});
