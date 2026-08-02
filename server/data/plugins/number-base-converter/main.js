function getSelections(view) {
	const { state } = view;
	return state.selection.ranges.map((range) => ({
		from: range.from,
		to: range.to,
		text: state.sliceDoc(range.from, range.to),
	}));
}

function replaceSelections(view, transform) {
	const selections = getSelections(view);
	view.dispatch({
		changes: selections.map((sel) => ({
			from: sel.from,
			to: sel.to,
			insert: transform(sel.text),
		})),
	});
}

function parseNumber(text) {
	const trimmed = text.trim();
	try {
		if (/^0x[0-9a-f]+$/i.test(trimmed)) return BigInt(trimmed);
		if (/^0b[01]+$/i.test(trimmed)) return BigInt(trimmed);
		if (/^0o[0-7]+$/i.test(trimmed)) return BigInt(trimmed);
		if (/^-?\d+$/.test(trimmed)) return BigInt(trimmed);
	} catch (err) {
		return null;
	}
	return null;
}

function convert(text, formatter) {
	const value = parseNumber(text);
	if (value === null) {
		window.toast?.("Selection isn't a recognizable integer (decimal, 0x, 0b, or 0o).");
		return text;
	}
	return formatter(value);
}

acode.setPluginInit("number-base-converter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "number-to-hex",
		description: "Number: Convert to Hex",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, (v) => `0x${v.toString(16)}`));
		},
	});

	acode.addCommand({
		name: "number-to-binary",
		description: "Number: Convert to Binary",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, (v) => `0b${v.toString(2)}`));
		},
	});

	acode.addCommand({
		name: "number-to-octal",
		description: "Number: Convert to Octal",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, (v) => `0o${v.toString(8)}`));
		},
	});

	acode.addCommand({
		name: "number-to-decimal",
		description: "Number: Convert to Decimal",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, (v) => v.toString(10)));
		},
	});
});

acode.setPluginUnmount("number-base-converter", () => {
	acode.removeCommand("number-to-hex");
	acode.removeCommand("number-to-binary");
	acode.removeCommand("number-to-octal");
	acode.removeCommand("number-to-decimal");
});
