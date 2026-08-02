const MARKER_PATTERN = /\b(TODO|FIXME|HACK|XXX|BUG)\b:?\s*(.*)/i;

function findMarkers(text) {
	return text
		.split("\n")
		.map((line, i) => {
			const match = line.match(MARKER_PATTERN);
			if (!match) return null;
			return `Line ${i + 1} [${match[1].toUpperCase()}]: ${match[2].trim() || line.trim()}`;
		})
		.filter(Boolean);
}

acode.setPluginInit("todo-manager", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "todo-list",
		description: "TODO: List TODO/FIXME/HACK Comments in File",
		requiresView: false,
		exec: async () => {
			const view = window.editorManager?.editor;
			if (!view) return;

			const markers = findMarkers(view.state.doc.toString());
			if (markers.length === 0) {
				window.toast?.("No TODO/FIXME/HACK comments found.");
				return;
			}

			const report = markers.join("\n");
			try {
				await navigator.clipboard.writeText(report);
				window.toast?.(
					`Found ${markers.length} marker${markers.length === 1 ? "" : "s"} - copied list to clipboard.`,
				);
			} catch (err) {
				window.toast?.(report);
			}
		},
	});
});

acode.setPluginUnmount("todo-manager", () => {
	acode.removeCommand("todo-list");
});
