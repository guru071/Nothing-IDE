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

function parseHex(text) {
	const match = text.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!match) return null;
	let hex = match[1];
	if (hex.length === 3) {
		hex = [...hex].map((c) => c + c).join("");
	}
	const int = Number.parseInt(hex, 16);
	return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function parseRgb(text) {
	const match = text
		.trim()
		.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i);
	if (!match) return null;
	return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function toHex({ r, g, b }) {
	return `#${[r, g, b].map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

function toRgb({ r, g, b }) {
	return `rgb(${r}, ${g}, ${b})`;
}

function toHsl({ r, g, b }) {
	const rN = r / 255;
	const gN = g / 255;
	const bN = b / 255;
	const max = Math.max(rN, gN, bN);
	const min = Math.min(rN, gN, bN);
	const l = (max + min) / 2;
	let h = 0;
	let s = 0;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case rN:
				h = (gN - bN) / d + (gN < bN ? 6 : 0);
				break;
			case gN:
				h = (bN - rN) / d + 2;
				break;
			default:
				h = (rN - gN) / d + 4;
		}
		h /= 6;
	}

	return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function convert(text, formatter) {
	const color = parseHex(text) || parseRgb(text);
	if (!color) {
		window.toast?.("Selection isn't a recognizable HEX or RGB color.");
		return text;
	}
	return formatter(color);
}

acode.setPluginInit("color-converter", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "color-to-hex",
		description: "Color: Convert to HEX",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, toHex));
		},
	});

	acode.addCommand({
		name: "color-to-rgb",
		description: "Color: Convert to RGB",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, toRgb));
		},
	});

	acode.addCommand({
		name: "color-to-hsl",
		description: "Color: Convert to HSL",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, (text) => convert(text, toHsl));
		},
	});
});

acode.setPluginUnmount("color-converter", () => {
	acode.removeCommand("color-to-hex");
	acode.removeCommand("color-to-rgb");
	acode.removeCommand("color-to-hsl");
});
