function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) return state.sliceDoc(range.from, range.to);
	return state.doc.toString();
}

function toHex(buffer) {
	return [...new Uint8Array(buffer)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function hashAndCopy(algorithm, label) {
	const view = window.editorManager?.editor;
	if (!view) return;

	const text = getTarget(view);
	if (!text) {
		window.toast?.("Nothing to hash.");
		return;
	}

	try {
		const data = new TextEncoder().encode(text);
		const digest = await window.crypto.subtle.digest(algorithm, data);
		const hex = toHex(digest);
		await navigator.clipboard.writeText(hex);
		window.toast?.(`${label}: ${hex}`);
	} catch (err) {
		window.toast?.(`Could not compute ${label}.`);
	}
}

acode.setPluginInit("hash-generator", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "hash-sha256",
		description: "Hash: Copy SHA-256 of Selection",
		requiresView: false,
		exec: () => hashAndCopy("SHA-256", "SHA-256"),
	});

	acode.addCommand({
		name: "hash-sha1",
		description: "Hash: Copy SHA-1 of Selection",
		requiresView: false,
		exec: () => hashAndCopy("SHA-1", "SHA-1"),
	});
});

acode.setPluginUnmount("hash-generator", () => {
	acode.removeCommand("hash-sha256");
	acode.removeCommand("hash-sha1");
});
