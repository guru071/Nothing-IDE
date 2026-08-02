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

// Strips combining diacritical marks (U+0300-U+036F) left behind by NFD
// normalization, e.g. turns "é" (e + combining acute) into plain "e".
function stripDiacritics(text) {
	return [...text]
		.filter((ch) => {
			const code = ch.codePointAt(0);
			return code < 0x0300 || code > 0x036f;
		})
		.join("");
}

function slugify(text) {
	return stripDiacritics(text.normalize("NFD"))
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

acode.setPluginInit("slugify", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "slugify-selection",
		description: "Slugify: Convert to URL Slug",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, slugify);
		},
	});
});

acode.setPluginUnmount("slugify", () => {
	acode.removeCommand("slugify-selection");
});
