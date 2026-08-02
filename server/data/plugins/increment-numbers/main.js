function incrementNumbersInText(text, delta) {
	return text.replace(/-?\d+/g, (match) => String(Number(match) + delta));
}

function findNumberAtOrNearCursor(lineText, cursorCol) {
	const regex = /-?\d+/g;
	let match = regex.exec(lineText);
	let best = null;

	while (match) {
		const start = match.index;
		const end = start + match[0].length;
		if (cursorCol >= start && cursorCol <= end) {
			return { start, end, text: match[0] };
		}
		const dist = cursorCol < start ? start - cursorCol : cursorCol - end;
		if (!best || dist < best.dist) best = { start, end, text: match[0], dist };
		match = regex.exec(lineText);
	}

	return best;
}

function applyDelta(view, delta) {
	const changes = [];

	for (const range of view.state.selection.ranges) {
		if (!range.empty) {
			const text = view.state.sliceDoc(range.from, range.to);
			changes.push({ from: range.from, to: range.to, insert: incrementNumbersInText(text, delta) });
			continue;
		}

		const line = view.state.doc.lineAt(range.from);
		const cursorCol = range.from - line.from;
		const found = findNumberAtOrNearCursor(line.text, cursorCol);
		if (!found) continue;

		const newValue = String(Number(found.text) + delta);
		changes.push({ from: line.from + found.start, to: line.from + found.end, insert: newValue });
	}

	if (changes.length) {
		view.dispatch({ changes });
	} else {
		window.toast?.("No number found near the cursor.");
	}
}

acode.setPluginInit("increment-numbers", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "number-increment",
		description: "Number: Increment by 1",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyDelta(view, 1);
		},
	});

	acode.addCommand({
		name: "number-decrement",
		description: "Number: Decrement by 1",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			applyDelta(view, -1);
		},
	});
});

acode.setPluginUnmount("increment-numbers", () => {
	acode.removeCommand("number-increment");
	acode.removeCommand("number-decrement");
});
