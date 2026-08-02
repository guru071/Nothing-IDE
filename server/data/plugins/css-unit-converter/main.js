const BASE_FONT_SIZE = 16;

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

function formatNumber(value) {
	return Number(value.toFixed(4)).toString();
}

function pxToRem(text) {
	const match = text.trim().match(/^(-?[\d.]+)px$/i);
	if (!match) {
		window.toast?.("Selection isn't a px value (e.g. 24px).");
		return text;
	}
	return `${formatNumber(Number(match[1]) / BASE_FONT_SIZE)}rem`;
}

function remToPx(text) {
	const match = text.trim().match(/^(-?[\d.]+)rem$/i);
	if (!match) {
		window.toast?.("Selection isn't a rem value (e.g. 1.5rem).");
		return text;
	}
	return `${formatNumber(Number(match[1]) * BASE_FONT_SIZE)}px`;
}

acode.setPluginInit("css-unit-converter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "css-px-to-rem",
		description: "CSS: px to rem (base 16px)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) replaceSelections(view, pxToRem);
		},
	});

	acode.addCommand({
		name: "css-rem-to-px",
		description: "CSS: rem to px (base 16px)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (view) replaceSelections(view, remToPx);
		},
	});
});

acode.setPluginUnmount("css-unit-converter", () => {
	acode.removeCommand("css-px-to-rem");
	acode.removeCommand("css-rem-to-px");
});
