function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) {
		return { from: range.from, to: range.to, text: state.sliceDoc(range.from, range.to) };
	}
	return { from: 0, to: state.doc.length, text: state.doc.toString() };
}

function parsePatternLine(line) {
	const match = line.match(/^\/(.*)\/([a-z]*)$/i);
	if (!match) return null;
	const flags = match[2].includes("g") ? match[2] : `${match[2]}g`;
	return new RegExp(match[1], flags);
}

function testRegex(text) {
	const newlineIndex = text.indexOf("\n");
	if (newlineIndex === -1) {
		throw new Error("expected a /pattern/flags line, then the text to test on following lines");
	}

	const patternLine = text.slice(0, newlineIndex).trim();
	const subject = text.slice(newlineIndex + 1);
	const regex = parsePatternLine(patternLine);
	if (!regex) {
		throw new Error("first line isn't a /pattern/flags regex literal");
	}

	const matches = [...subject.matchAll(regex)];
	const report = matches.map((m, i) => {
		const groups = m.length > 1 ? ` groups: ${JSON.stringify(m.slice(1))}` : "";
		return `${i + 1}. "${m[0]}" at index ${m.index}${groups}`;
	});

	const summary = `${matches.length} match${matches.length === 1 ? "" : "es"} for ${patternLine}`;
	return [summary, ...report].join("\n");
}

acode.setPluginInit("regex-tester", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "regex-test",
		description: "Regex: Test Pattern (first line /pattern/flags, rest is subject text)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			const target = getTarget(view);
			try {
				const report = testRegex(target.text);
				const insert = `${target.text}\n\n--- matches ---\n${report}`;
				view.dispatch({ changes: { from: target.from, to: target.to, insert } });
			} catch (err) {
				window.toast?.(err.message);
			}
		},
	});
});

acode.setPluginUnmount("regex-tester", () => {
	acode.removeCommand("regex-test");
});
