function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function linesToInClause(text, quote) {
	const values = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	if (values.length === 0) {
		window.toast?.("No non-empty lines found.");
		return text;
	}

	const formatted = quote
		? values.map((v) => `'${v.replace(/'/g, "''")}'`)
		: values;

	return `IN (${formatted.join(", ")})`;
}

acode.setPluginInit("sql-in-clause", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "sql-in-clause-strings",
		description: "SQL: Lines to IN Clause (quoted strings)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			const result = linesToInClause(target.text, true);
			view.dispatch({ changes: { from: target.from, to: target.to, insert: result } });
		},
	});

	acode.addCommand({
		name: "sql-in-clause-numbers",
		description: "SQL: Lines to IN Clause (numbers)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			const result = linesToInClause(target.text, false);
			view.dispatch({ changes: { from: target.from, to: target.to, insert: result } });
		},
	});
});

acode.setPluginUnmount("sql-in-clause", () => {
	acode.removeCommand("sql-in-clause-strings");
	acode.removeCommand("sql-in-clause-numbers");
});
