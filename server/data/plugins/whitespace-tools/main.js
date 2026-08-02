function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function applyTransform(view, transform) {
	const target = getTarget(view);
	view.dispatch({ changes: { from: target.from, to: target.to, insert: transform(target.text) } });
}

function trimTrailingWhitespace(text) {
	return text
		.split("\n")
		.map((line) => line.replace(/[ \t]+$/, ""))
		.join("\n");
}

function removeBlankLines(text) {
	return text
		.split("\n")
		.filter((line) => line.trim() !== "")
		.join("\n");
}

function tabsToSpaces(text) {
	return text.replace(/\t/g, "    ");
}

function normalizeLineEndings(text) {
	return text.replace(/\r\n/g, "\n");
}

acode.setPluginInit("whitespace-tools", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "whitespace-trim-trailing",
		description: "Whitespace: Trim Trailing Whitespace",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyTransform(view, trimTrailingWhitespace);
		},
	});

	acode.addCommand({
		name: "whitespace-remove-blank-lines",
		description: "Whitespace: Remove Blank Lines",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyTransform(view, removeBlankLines);
		},
	});

	acode.addCommand({
		name: "whitespace-tabs-to-spaces",
		description: "Whitespace: Tabs to Spaces (4)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyTransform(view, tabsToSpaces);
		},
	});

	acode.addCommand({
		name: "whitespace-normalize-line-endings",
		description: "Whitespace: CRLF to LF",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyTransform(view, normalizeLineEndings);
		},
	});
});

acode.setPluginUnmount("whitespace-tools", () => {
	acode.removeCommand("whitespace-trim-trailing");
	acode.removeCommand("whitespace-remove-blank-lines");
	acode.removeCommand("whitespace-tabs-to-spaces");
	acode.removeCommand("whitespace-normalize-line-endings");
});
