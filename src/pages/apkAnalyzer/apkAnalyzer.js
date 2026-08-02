import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import JSZip from "jszip";
import actionStack from "lib/actionStack";
import { parseAxml, summarizeManifest } from "lib/axmlParser";
import { loadFileBrowser } from "lib/lazyImports";

const SIZE_CATEGORIES = [
	{ label: "DEX (code)", test: (name) => /^classes\d*\.dex$/.test(name) },
	{ label: "Native libraries", test: (name) => name.startsWith("lib/") },
	{ label: "Resources (res/)", test: (name) => name.startsWith("res/") },
	{ label: "Assets", test: (name) => name.startsWith("assets/") },
	{ label: "resources.arsc", test: (name) => name === "resources.arsc" },
	{ label: "Signing (META-INF)", test: (name) => name.startsWith("META-INF/") },
];

/**
 * @param {{url: string, name: string}} [initialFile] Skip the file picker
 * and analyze this file directly (e.g. a build's just-produced APK).
 */
export default function ApkAnalyzer(initialFile) {
	const $page = Page("APK Analyzer");
	const $meta = <div className="apk-meta">No APK selected.</div>;
	const $chooseButton = (
		<button type="button" className="action-button" data-action="choose">
			Choose APK
		</button>
	);
	const $results = <div className="apk-results"></div>;

	const $content = (
		<div id="apk-analyzer">
			{$chooseButton}
			{$meta}
			{$results}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("apk-analyzer");
	};
	actionStack.push({ id: "apk-analyzer", action: $page.hide });

	$chooseButton.addEventListener("click", chooseFile);

	if (initialFile?.url) {
		analyze(initialFile.url, initialFile.name || initialFile.url);
	} else {
		chooseFile();
	}

	async function chooseFile() {
		try {
			const FileBrowser = await loadFileBrowser();
			const res = await FileBrowser("file", "Select an APK file");
			if (!res?.url) return;
			await analyze(res.url, res.name || res.url);
		} catch (error) {
			// user cancelled the picker
		}
	}

	async function analyze(url, name) {
		$meta.textContent = "Analyzing...";
		$results.textContent = "";

		try {
			const data = await fsOperation(url).readFile();
			const zip = await JSZip.loadAsync(data);

			const manifestEntry = zip.file("AndroidManifest.xml");
			if (!manifestEntry) {
				throw new Error("Not a valid APK (no AndroidManifest.xml found).");
			}
			const manifestBuffer = await manifestEntry.async("arraybuffer");
			const manifestTree = parseAxml(manifestBuffer);
			const info = summarizeManifest(manifestTree);

			const sizes = computeSizeBreakdown(zip);
			const totalSize = data.byteLength ?? data.length ?? 0;

			$meta.textContent = name;
			renderResults(info, sizes, totalSize);
		} catch (error) {
			toast(`Couldn't analyze APK: ${error?.message || error}`);
			$meta.textContent = "No APK selected.";
		}
	}

	function computeSizeBreakdown(zip) {
		const sizes = SIZE_CATEGORIES.map((c) => ({ label: c.label, bytes: 0 }));
		let otherBytes = 0;

		zip.forEach((relativePath, entry) => {
			if (entry.dir) return;
			const uncompressedSize = entry._data?.uncompressedSize ?? 0;
			const category = SIZE_CATEGORIES.findIndex((c) => c.test(relativePath));
			if (category >= 0) sizes[category].bytes += uncompressedSize;
			else otherBytes += uncompressedSize;
		});

		sizes.push({ label: "Other", bytes: otherBytes });
		return sizes.filter((s) => s.bytes > 0).sort((a, b) => b.bytes - a.bytes);
	}

	function formatBytes(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	function renderResults(info, sizes, totalSize) {
		$results.textContent = "";
		$results.append(
			<div className="apk-section">
				<div className="apk-section-title">Package</div>
				<div className="apk-row">
					<span>Package name</span>
					<span>{info.package || "unknown"}</span>
				</div>
				<div className="apk-row">
					<span>Version</span>
					<span>
						{info.versionName ?? "?"} (code {info.versionCode ?? "?"})
					</span>
				</div>
				<div className="apk-row">
					<span>SDK range</span>
					<span>
						min {info.minSdkVersion ?? "?"} / target{" "}
						{info.targetSdkVersion ?? "?"}
					</span>
				</div>
				<div className="apk-row">
					<span>Components</span>
					<span>
						{info.activityCount} activities, {info.serviceCount} services,{" "}
						{info.receiverCount} receivers, {info.providerCount} providers
					</span>
				</div>
			</div>,
			<div className="apk-section">
				<div className="apk-section-title">
					Permissions ({info.permissions.length})
				</div>
				{info.permissions.length ? (
					<div className="apk-permissions">
						{info.permissions.map((p) => (
							<div className="apk-permission">{p}</div>
						))}
					</div>
				) : (
					<div className="apk-empty">None declared.</div>
				)}
			</div>,
			<div className="apk-section">
				<div className="apk-section-title">
					Size breakdown - {formatBytes(totalSize)} total
				</div>
				{sizes.map((s) => (
					<div className="apk-size-row">
						<div className="apk-size-bar-track">
							<div
								className="apk-size-bar"
								style={{
									width: `${Math.min(100, (s.bytes / totalSize) * 100)}%`,
								}}
							></div>
						</div>
						<span className="apk-size-label">{s.label}</span>
						<span className="apk-size-value">{formatBytes(s.bytes)}</span>
					</div>
				))}
			</div>,
		);
	}
}
