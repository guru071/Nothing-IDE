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

function toWords(text) {
	return text
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[_-]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase());
}

function capitalize(word) {
	return word.charAt(0).toUpperCase() + word.slice(1);
}

const CONVERTERS = {
	"case-to-camel": (text) => {
		const words = toWords(text);
		return words.map((w, i) => (i === 0 ? w : capitalize(w))).join("");
	},
	"case-to-pascal": (text) => toWords(text).map(capitalize).join(""),
	"case-to-snake": (text) => toWords(text).join("_"),
	"case-to-kebab": (text) => toWords(text).join("-"),
	"case-to-constant": (text) => toWords(text).join("_").toUpperCase(),
};

const COMMAND_LABELS = {
	"case-to-camel": "Case: Convert to camelCase",
	"case-to-pascal": "Case: Convert to PascalCase",
	"case-to-snake": "Case: Convert to snake_case",
	"case-to-kebab": "Case: Convert to kebab-case",
	"case-to-constant": "Case: Convert to CONSTANT_CASE",
};

acode.setPluginInit("case-converter", (baseUrl, $page, options) => {
	for (const name of Object.keys(CONVERTERS)) {
		acode.addCommand({
			name,
			description: COMMAND_LABELS[name],
			requiresView: false,
			exec: () => {
				const view = window.editorManager?.editor;
				if (!view) return;
				replaceSelections(view, CONVERTERS[name]);
			},
		});
	}
});

acode.setPluginUnmount("case-converter", () => {
	for (const name of Object.keys(CONVERTERS)) {
		acode.removeCommand(name);
	}
});
