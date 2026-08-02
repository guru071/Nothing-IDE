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

acode.setPluginInit("url-tools", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "url-encode-selection",
		description: "URL: Encode Selection",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => {
				try {
					return encodeURIComponent(text);
				} catch (err) {
					window.toast?.("Could not URL-encode selection.");
					return text;
				}
			});
		},
	});

	acode.addCommand({
		name: "url-decode-selection",
		description: "URL: Decode Selection",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => {
				try {
					return decodeURIComponent(text);
				} catch (err) {
					window.toast?.("Selected text isn't valid URL-encoded text.");
					return text;
				}
			});
		},
	});
});

acode.setPluginUnmount("url-tools", () => {
	acode.removeCommand("url-encode-selection");
	acode.removeCommand("url-decode-selection");
});
