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

function escapeString(text) {
	// JSON.stringify already produces a correctly-escaped double-quoted
	// string literal - strip the surrounding quotes it adds.
	return JSON.stringify(text).slice(1, -1);
}

function unescapeString(text) {
	try {
		return JSON.parse(`"${text}"`);
	} catch (err) {
		window.toast?.("Selection isn't validly-escaped string content.");
		return text;
	}
}

acode.setPluginInit("string-escape", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "string-escape",
		description: "String: Escape",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, escapeString);
		},
	});

	acode.addCommand({
		name: "string-unescape",
		description: "String: Unescape",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, unescapeString);
		},
	});
});

acode.setPluginUnmount("string-escape", () => {
	acode.removeCommand("string-escape");
	acode.removeCommand("string-unescape");
});
