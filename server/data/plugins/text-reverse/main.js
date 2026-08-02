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

function reverseChars(text) {
	return [...text].reverse().join("");
}

function reverseWords(text) {
	return text.trim().split(/\s+/).reverse().join(" ");
}

acode.setPluginInit("text-reverse", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "text-reverse-chars",
		description: "Text: Reverse Characters",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, reverseChars);
		},
	});

	acode.addCommand({
		name: "text-reverse-words",
		description: "Text: Reverse Word Order",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, reverseWords);
		},
	});
});

acode.setPluginUnmount("text-reverse", () => {
	acode.removeCommand("text-reverse-chars");
	acode.removeCommand("text-reverse-words");
});
