function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) return state.sliceDoc(range.from, range.to);
	return state.doc.toString();
}

function computeStats(text) {
	const chars = text.length;
	const charsNoSpaces = text.replace(/\s/g, "").length;
	const words = text.trim() ? text.trim().split(/\s+/).length : 0;
	const lines = text ? text.split("\n").length : 0;
	return { chars, charsNoSpaces, words, lines };
}

acode.setPluginInit("text-stats", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "text-stats-show",
		description: "Text: Show Statistics",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const { chars, charsNoSpaces, words, lines } = computeStats(getTarget(view));
			window.toast?.(
				`${chars} chars (${charsNoSpaces} no spaces), ${words} words, ${lines} lines`,
			);
		},
	});
});

acode.setPluginUnmount("text-stats", () => {
	acode.removeCommand("text-stats-show");
});
