// High-confidence, structurally-recognizable secret patterns only - no
// generic "password =" keyword matching, since that's overwhelmingly false
// positives (empty strings, form templates, variable names) and would make
// the report useless noise.
const PATTERNS = [
	{ name: "AWS Access Key ID", regex: /\bAKIA[0-9A-Z]{16}\b/g },
	{ name: "GitHub Token", regex: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g },
	{ name: "GitHub Fine-Grained PAT", regex: /\bgithub_pat_[A-Za-z0-9_]{82}\b/g },
	{ name: "Slack Token", regex: /\bxox[baprs]-[0-9A-Za-z-]{10,48}\b/g },
	{ name: "Google API Key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
	{ name: "Stripe Live Secret Key", regex: /\bsk_live_[0-9a-zA-Z]{24,}\b/g },
	{ name: "npm Token", regex: /\bnpm_[A-Za-z0-9]{36}\b/g },
	{
		name: "Private Key Block",
		regex: /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
	},
	{
		name: "JWT",
		regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
	},
	{
		name: "URL with Embedded Credentials",
		regex: /https?:\/\/[^\/\s:]+:[^\/\s@]+@[^\/\s]+/g,
	},
];

function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) return state.sliceDoc(range.from, range.to);
	return state.doc.toString();
}

function scan(text) {
	const lines = text.split("\n");
	const findings = [];

	lines.forEach((line, i) => {
		for (const { name, regex } of PATTERNS) {
			regex.lastIndex = 0;
			let match = regex.exec(line);
			while (match) {
				findings.push(`Line ${i + 1}: ${name} - "${match[0]}"`);
				match = regex.exec(line);
			}
		}
	});

	return findings;
}

acode.setPluginInit("secret-scanner", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "secret-scan",
		description: "Secrets: Scan Selection/File for Leaked Credentials",
		requiresView: false,
		exec: async () => {
			const view = window.editorManager?.editor;
			if (!view) return;

			const findings = scan(getTarget(view));
			if (findings.length === 0) {
				window.toast?.("No obvious leaked credentials found.");
				return;
			}

			const report = findings.join("\n");
			try {
				await navigator.clipboard.writeText(report);
				window.toast?.(
					`Found ${findings.length} possible secret${findings.length === 1 ? "" : "s"} - copied report to clipboard.`,
				);
			} catch (err) {
				window.toast?.(report);
			}
		},
	});
});

acode.setPluginUnmount("secret-scanner", () => {
	acode.removeCommand("secret-scan");
});
