const CHARSET =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";

function generatePassword(length) {
	const bytes = new Uint8Array(length);
	window.crypto.getRandomValues(bytes);
	return [...bytes].map((b) => CHARSET[b % CHARSET.length]).join("");
}

async function generateAndCopy(length) {
	const password = generatePassword(length);
	try {
		await navigator.clipboard.writeText(password);
		window.toast?.(`Copied ${length}-character password to clipboard.`);
	} catch (err) {
		window.toast?.(password);
	}
}

acode.setPluginInit("password-generator", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "password-generate-16",
		description: "Password: Generate 16 Characters",
		requiresView: false,
		exec: () => generateAndCopy(16),
	});

	acode.addCommand({
		name: "password-generate-32",
		description: "Password: Generate 32 Characters",
		requiresView: false,
		exec: () => generateAndCopy(32),
	});
});

acode.setPluginUnmount("password-generator", () => {
	acode.removeCommand("password-generate-16");
	acode.removeCommand("password-generate-32");
});
