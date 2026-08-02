function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return {
			from: range.from,
			to: range.to,
			text: state.sliceDoc(range.from, range.to),
		};
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function applyJsonTransform(view, transform) {
	const target = getTarget(view);
	try {
		const parsed = JSON.parse(target.text);
		view.dispatch({
			changes: { from: target.from, to: target.to, insert: transform(parsed) },
		});
	} catch (err) {
		window.toast?.(`Not valid JSON: ${err.message}`);
	}
}

acode.setPluginInit("json-formatter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "json-format",
		description: "JSON: Format (Pretty Print)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyJsonTransform(view, (parsed) => JSON.stringify(parsed, null, 2));
		},
	});

	acode.addCommand({
		name: "json-minify",
		description: "JSON: Minify",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyJsonTransform(view, (parsed) => JSON.stringify(parsed));
		},
	});
});

acode.setPluginUnmount("json-formatter", () => {
	acode.removeCommand("json-format");
	acode.removeCommand("json-minify");
});
