import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import androidBuilder from "lib/androidBuilder";
import Url from "utils/Url";

const OUTPUT_APK_NAME = "app-debug.apk";

/**
 * A dedicated UI for the on-device Android build toolchain (lib/
 * androidBuilder.js) - previously only reachable via two command palette
 * entries with no status feedback. This is a real toolchain (aapt2 + javac
 * + D8 + jarsigner, no Gradle - see androidBuild/build.sh), for raw
 * Java-source Android projects (AndroidManifest.xml + src/), not
 * Cordova/Gradle projects like this app itself.
 */
export default function AndroidBuild() {
	const $page = Page("Android Build");

	const project = androidBuilder.getProject();

	const $status = (
		<div className="ab-status">
			{project
				? `Project: ${project.name}`
				: "No project folder open (or it isn't accessible from the built-in terminal)."}
		</div>
	);

	const $setupButton = (
		<button type="button" className="action-button" data-action="setup">
			Set Up Build Tools
		</button>
	);
	const $buildButton = (
		<button
			type="button"
			className="action-button"
			data-action="build"
			disabled={!project}
		>
			Build APK
		</button>
	);
	const $analyzeButton = (
		<button
			type="button"
			className="action-button secondary"
			data-action="analyze"
			disabled={!project}
		>
			Analyze Last Build
		</button>
	);

	const $content = (
		<div id="android-build">
			<p className="ab-intro">
				Builds a debug APK on-device from a raw Android project (
				<code>AndroidManifest.xml</code> + <code>src/</code>, Java only, no
				Gradle) using aapt2, javac, and D8 in the terminal sandbox. Run setup
				once first - it needs a pre-existing <code>aapt2</code> binary on the
				system (not bundled).
			</p>
			{$status}
			{$setupButton}
			{$buildButton}
			{$analyzeButton}
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("android-build");
	};
	actionStack.push({ id: "android-build", action: $page.hide });

	$setupButton.addEventListener("click", async () => {
		try {
			await androidBuilder.runSetup();
		} catch (error) {
			toast(`Setup failed: ${error?.message || error}`);
		}
	});

	$buildButton.addEventListener("click", async () => {
		if (!project) return;
		try {
			await androidBuilder.buildInTerminal(project.path, project.name);
			toast("Build started - watch the terminal tab for progress.");
		} catch (error) {
			toast(`Build failed: ${error?.message || error}`);
		}
	});

	$analyzeButton.addEventListener("click", async () => {
		if (!project) return;
		const apkUrl = Url.join(project.url, OUTPUT_APK_NAME);
		const exists = await fsOperation(apkUrl)
			.exists()
			.catch(() => false);
		if (!exists) {
			toast(`No ${OUTPUT_APK_NAME} found yet - run a build first.`);
			return;
		}
		const ApkAnalyzer = (
			await import(
				/* webpackChunkName: "apkAnalyzer" */ "pages/apkAnalyzer/apkAnalyzer"
			)
		).default;
		ApkAnalyzer({ url: apkUrl, name: OUTPUT_APK_NAME });
	});
}
