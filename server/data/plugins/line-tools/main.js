function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function applyLineTransform(view, transform) {
	const target = getTarget(view);
	const lines = target.text.split("\n");
	const result = transform(lines).join("\n");
	view.dispatch({ changes: { from: target.from, to: target.to, insert: result } });
}

function shuffle(arr) {
	const result = arr.slice();
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

acode.setPluginInit("line-tools", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "lines-sort-asc",
		description: "Lines: Sort Ascending",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyLineTransform(view, (lines) => lines.slice().sort((a, b) => a.localeCompare(b)));
		},
	});

	acode.addCommand({
		name: "lines-sort-desc",
		description: "Lines: Sort Descending",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyLineTransform(view, (lines) => lines.slice().sort((a, b) => b.localeCompare(a)));
		},
	});

	acode.addCommand({
		name: "lines-unique",
		description: "Lines: Remove Duplicates",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyLineTransform(view, (lines) => [...new Set(lines)]);
		},
	});

	acode.addCommand({
		name: "lines-shuffle",
		description: "Lines: Shuffle",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyLineTransform(view, shuffle);
		},
	});
});

acode.setPluginUnmount("line-tools", () => {
	acode.removeCommand("lines-sort-asc");
	acode.removeCommand("lines-sort-desc");
	acode.removeCommand("lines-unique");
	acode.removeCommand("lines-shuffle");
});
