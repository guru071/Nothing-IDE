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

function base64UrlDecode(segment) {
	const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
	const withPadding = padded + "=".repeat((4 - (padded.length % 4)) % 4);
	return decodeURIComponent(escape(window.atob(withPadding)));
}

function decodeJwt(text) {
	const parts = text.trim().split(".");
	if (parts.length < 2) {
		window.toast?.("Selection isn't a JWT (expected header.payload.signature).");
		return text;
	}

	try {
		const header = JSON.parse(base64UrlDecode(parts[0]));
		const payload = JSON.parse(base64UrlDecode(parts[1]));
		return `${JSON.stringify(header, null, 2)}\n\n${JSON.stringify(payload, null, 2)}`;
	} catch (err) {
		window.toast?.("Could not decode JWT - not valid Base64URL/JSON.");
		return text;
	}
}

acode.setPluginInit("jwt-decoder", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "jwt-decode-selection",
		description: "JWT: Decode Selection (Header + Payload)",
		requiresView: false,
		exec: () => {
			const view = window.editorManager?.editor;
			if (!view) return;
			replaceSelections(view, decodeJwt);
		},
	});
});

acode.setPluginUnmount("jwt-decoder", () => {
	acode.removeCommand("jwt-decode-selection");
});
