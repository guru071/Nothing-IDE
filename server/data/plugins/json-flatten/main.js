function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function flatten(value, prefix, result) {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			result[prefix] = [];
			return;
		}
		value.forEach((item, i) => flatten(item, prefix ? `${prefix}.${i}` : String(i), result));
		return;
	}
	if (value !== null && typeof value === "object") {
		const keys = Object.keys(value);
		if (keys.length === 0) {
			result[prefix] = {};
			return;
		}
		for (const key of keys) {
			flatten(value[key], prefix ? `${prefix}.${key}` : key, result);
		}
		return;
	}
	result[prefix] = value;
}

function flattenJson(text) {
	const parsed = JSON.parse(text);
	const result = {};
	flatten(parsed, "", result);
	return JSON.stringify(result, null, 2);
}

function unflattenJson(text) {
	const flat = JSON.parse(text);
	const root = {};

	for (const [path, value] of Object.entries(flat)) {
		const segments = path.split(".");
		let cursor = root;
		for (let i = 0; i < segments.length - 1; i++) {
			const key = segments[i];
			if (cursor[key] === undefined) {
				// Peek at the next segment to decide array vs object.
				cursor[key] = /^\d+$/.test(segments[i + 1]) ? [] : {};
			}
			cursor = cursor[key];
		}
		cursor[segments[segments.length - 1]] = value;
	}

	// Object.keys on an array-shaped plain object still works via bracket
	// assignment above since arrays accept numeric string indices directly.
	return JSON.stringify(root, null, 2);
}

acode.setPluginInit("json-flatten", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "json-flatten-to-dots",
		description: "JSON: Flatten to Dot Notation",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			try {
				view.dispatch({
					changes: { from: target.from, to: target.to, insert: flattenJson(target.text) },
				});
			} catch (err) {
				window.toast?.(`Not valid JSON: ${err.message}`);
			}
		},
	});

	acode.addCommand({
		name: "json-unflatten",
		description: "JSON: Unflatten from Dot Notation",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			try {
				view.dispatch({
					changes: { from: target.from, to: target.to, insert: unflattenJson(target.text) },
				});
			} catch (err) {
				window.toast?.(`Not valid flattened JSON: ${err.message}`);
			}
		},
	});
});

acode.setPluginUnmount("json-flatten", () => {
	acode.removeCommand("json-flatten-to-dots");
	acode.removeCommand("json-unflatten");
});
