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

function unixToIso(text) {
	const trimmed = text.trim();
	if (!/^\d+$/.test(trimmed)) {
		window.toast?.("Selection isn't a Unix timestamp.");
		return text;
	}
	// 10-digit values are seconds, longer ones are already milliseconds.
	const ms = trimmed.length <= 10 ? Number(trimmed) * 1000 : Number(trimmed);
	const date = new Date(ms);
	if (Number.isNaN(date.getTime())) {
		window.toast?.("Selection isn't a valid Unix timestamp.");
		return text;
	}
	return date.toISOString();
}

function isoToUnix(text) {
	const date = new Date(text.trim());
	if (Number.isNaN(date.getTime())) {
		window.toast?.("Selection isn't a valid date string.");
		return text;
	}
	return String(Math.floor(date.getTime() / 1000));
}

acode.setPluginInit("timestamp-converter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "timestamp-to-iso",
		description: "Timestamp: Unix to ISO Date",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, unixToIso);
		},
	});

	acode.addCommand({
		name: "timestamp-to-unix",
		description: "Timestamp: ISO Date to Unix",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, isoToUnix);
		},
	});

	acode.addCommand({
		name: "timestamp-insert-now",
		description: "Timestamp: Insert Current Unix Time",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const { from, to } = view.state.selection.main;
			const now = String(Math.floor(Date.now() / 1000));
			view.dispatch({ changes: { from, to, insert: now } });
		},
	});
});

acode.setPluginUnmount("timestamp-converter", () => {
	acode.removeCommand("timestamp-to-iso");
	acode.removeCommand("timestamp-to-unix");
	acode.removeCommand("timestamp-insert-now");
});
