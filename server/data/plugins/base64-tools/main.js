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

acode.setPluginInit("base64-tools", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "base64-encode-selection",
		description: "Base64: Encode Selection",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => {
				try {
					return window.btoa(unescape(encodeURIComponent(text)));
				} catch (err) {
					window.toast?.("Could not encode selection.");
					return text;
				}
			});
		},
	});

	acode.addCommand({
		name: "base64-decode-selection",
		description: "Base64: Decode Selection",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => {
				try {
					return decodeURIComponent(escape(window.atob(text)));
				} catch (err) {
					window.toast?.("Selected text isn't valid Base64.");
					return text;
				}
			});
		},
	});
});

acode.setPluginUnmount("base64-tools", () => {
	acode.removeCommand("base64-encode-selection");
	acode.removeCommand("base64-decode-selection");
});
