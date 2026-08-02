function getSelections(view) {
	const { state } = view;
	return state.selection.ranges.map((range) => ({
		from: range.from,
		to: range.to,
		text: state.sliceDoc(range.from, range.to),
	}));
}

function toggleWrap(view, marker) {
	const selections = getSelections(view);
	view.dispatch({
		changes: selections.map((sel) => {
			const { text } = sel;
			if (text.startsWith(marker) && text.endsWith(marker) && text.length >= marker.length * 2) {
				return { from: sel.from, to: sel.to, insert: text.slice(marker.length, -marker.length) };
			}
			return { from: sel.from, to: sel.to, insert: `${marker}${text}${marker}` };
		}),
	});
}

function insertLink(view) {
	const selections = getSelections(view);
	view.dispatch({
		changes: selections.map((sel) => ({
			from: sel.from,
			to: sel.to,
			insert: `[${sel.text || "link text"}](url)`,
		})),
	});
}

acode.setPluginInit("markdown-tools", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "markdown-bold",
		description: "Markdown: Toggle Bold",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) toggleWrap(view, "**");
		},
	});

	acode.addCommand({
		name: "markdown-italic",
		description: "Markdown: Toggle Italic",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) toggleWrap(view, "_");
		},
	});

	acode.addCommand({
		name: "markdown-strikethrough",
		description: "Markdown: Toggle Strikethrough",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) toggleWrap(view, "~~");
		},
	});

	acode.addCommand({
		name: "markdown-inline-code",
		description: "Markdown: Toggle Inline Code",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) toggleWrap(view, "`");
		},
	});

	acode.addCommand({
		name: "markdown-insert-link",
		description: "Markdown: Insert Link",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) insertLink(view);
		},
	});
});

acode.setPluginUnmount("markdown-tools", () => {
	acode.removeCommand("markdown-bold");
	acode.removeCommand("markdown-italic");
	acode.removeCommand("markdown-strikethrough");
	acode.removeCommand("markdown-inline-code");
	acode.removeCommand("markdown-insert-link");
});
