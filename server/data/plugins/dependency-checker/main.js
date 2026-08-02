function stripRange(version) {
	return String(version).replace(/^[\^~>=<]+/, "").trim();
}

async function fetchLatestVersion(name) {
	const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = await res.json();
	return data.version;
}

async function checkPackageJson(text) {
	const pkg = JSON.parse(text);
	const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
	const names = Object.keys(deps);
	if (names.length === 0) {
		throw new Error("no dependencies/devDependencies found");
	}

	const results = await Promise.allSettled(names.map((name) => fetchLatestVersion(name)));

	const outdated = [];
	const failed = [];
	results.forEach((result, i) => {
		const name = names[i];
		if (result.status === "rejected") {
			failed.push(`${name}: could not check (${result.reason.message})`);
			return;
		}
		const pinned = stripRange(deps[name]);
		if (pinned !== result.value) {
			outdated.push(`${name}: ${deps[name]} -> latest ${result.value}`);
		}
	});

	return { outdated, failed, total: names.length };
}

function getTarget(view) {
	const { state } = view;
	const range = state.selection.main;
	if (!range.empty) return state.sliceDoc(range.from, range.to);
	return state.doc.toString();
}

acode.setPluginInit("dependency-checker", (baseUrl, $page, options) => {
	acode.addCommand({
		name: "dependency-check",
		description: "Dependencies: Check package.json for Outdated Versions",
		requiresView: false,
		exec: async () => {
			const view = window.editorManager?.editor;
			if (!view) return;

			window.toast?.("Checking dependencies against the npm registry...");

			try {
				const { outdated, failed, total } = await checkPackageJson(getTarget(view));
				const lines = [
					`Checked ${total} package(s): ${outdated.length} outdated, ${failed.length} failed to check.`,
					...outdated,
					...failed,
				];
				const report = lines.join("\n");
				try {
					await navigator.clipboard.writeText(report);
					window.toast?.(`${lines[0]} Copied report to clipboard.`);
				} catch (err) {
					window.toast?.(report);
				}
			} catch (err) {
				window.toast?.(`Could not check dependencies: ${err.message}`);
			}
		},
	});
});

acode.setPluginUnmount("dependency-checker", () => {
	acode.removeCommand("dependency-check");
});
