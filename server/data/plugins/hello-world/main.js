acode.setPluginInit("hello-world", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "hello-world-say-hi",
		description: "Hello World: Say Hi",
		requiresView: false,
		exec: () => {
			window.toast?.("Hello from your plugin server!");
		},
	});
});

acode.setPluginUnmount("hello-world", () => {
	acode.removeCommand("hello-world-say-hi");
});
