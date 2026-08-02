acode.setPluginInit("uuid-generator", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "uuid-generator-generate",
		description: "UUID Generator: Copy a new UUID v4",
		requiresView: false,
		exec: async () => {
			const uuid = crypto.randomUUID();
			try {
				await navigator.clipboard.writeText(uuid);
				window.toast?.(`Copied: ${uuid}`);
			} catch (err) {
				window.toast?.(uuid);
			}
		},
	});
});

acode.setPluginUnmount("uuid-generator", () => {
	acode.removeCommand("uuid-generator-generate");
});
