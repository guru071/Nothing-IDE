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

const NAMED_ENTITIES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

const NAMED_DECODE = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

function encodeEntities(text) {
	return text.replace(/[&<>"']/g, (ch) => NAMED_ENTITIES[ch]);
}

function decodeEntities(text) {
	return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body) => {
		if (body[0] === "#") {
			const codePoint =
				body[1]?.toLowerCase() === "x"
					? Number.parseInt(body.slice(2), 16)
					: Number.parseInt(body.slice(1), 10);
			return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
		}
		const lower = body.toLowerCase();
		return lower in NAMED_DECODE ? NAMED_DECODE[lower] : match;
	});
}

acode.setPluginInit("html-entities", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "html-entities-encode",
		description: "HTML Entities: Encode Selection",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, encodeEntities);
		},
	});

	acode.addCommand({
		name: "html-entities-decode",
		description: "HTML Entities: Decode Selection",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, decodeEntities);
		},
	});
});

acode.setPluginUnmount("html-entities", () => {
	acode.removeCommand("html-entities-encode");
	acode.removeCommand("html-entities-decode");
});
