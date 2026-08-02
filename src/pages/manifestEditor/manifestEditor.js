import "./style.scss";
import fsOperation from "fileSystem";
import Page from "components/page";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import prompt from "dialogs/prompt";
import { addedFolder } from "lib/openFolder";
import Url from "utils/Url";

const ANDROID_NS = "http://schemas.android.com/apk/res/android";
const CANDIDATE_FILES = ["AndroidManifest.xml", "config.xml"];

/**
 * A structured editor over whichever real manifest this project has:
 * AndroidManifest.xml for a raw Android project, or config.xml for a
 * Cordova project (this app's own project type) - both use
 * <uses-permission> the same way, just nested differently, so permissions
 * are found by tag name anywhere in the document rather than assuming one
 * layout.
 */
export default function ManifestEditor() {
	const $page = Page("Manifest Editor");
	const $status = <div className="me-status">Looking for a manifest...</div>;
	const $form = <div className="me-form"></div>;
	const $saveButton = (
		<button type="button" className="action-button" data-action="save" hidden>
			Save
		</button>
	);

	const $content = (
		<div id="manifest-editor">
			{$status}
			{$form}
			{$saveButton}
		</div>
	);

	$page.body = $content;
	app.append($page);

	let fileUrl = null;
	let doc = null;
	let isConfigXml = false;

	load();

	async function load() {
		const folder = addedFolder[0];
		if (!folder) {
			$status.textContent = "No project folder open.";
			return;
		}

		for (const candidate of CANDIDATE_FILES) {
			const url = Url.join(folder.url, candidate);
			const exists = await fsOperation(url)
				.exists()
				.catch(() => false);
			if (exists) {
				fileUrl = url;
				isConfigXml = candidate === "config.xml";
				break;
			}
		}

		if (!fileUrl) {
			$status.textContent =
				"No AndroidManifest.xml or config.xml found in the project root.";
			return;
		}

		try {
			const text = await fsOperation(fileUrl).readFile("utf8");
			doc = new DOMParser().parseFromString(text, "application/xml");
			if (doc.querySelector("parsererror")) {
				throw new Error("The file isn't valid XML.");
			}
			$status.textContent = `Editing ${Url.basename(fileUrl)}`;
			$saveButton.hidden = false;
			render();
		} catch (error) {
			$status.textContent = `Couldn't read manifest: ${error?.message || error}`;
		}
	}

	/**
	 * Where a NEW <uses-permission> must go to actually take effect. For a
	 * raw AndroidManifest.xml it's a direct child of <manifest>. For a
	 * Cordova config.xml, Cordova only honors <uses-permission> nested
	 * inside <platform name="android"><config-file
	 * target="AndroidManifest.xml" parent="/manifest">...</config-file>
	 * </platform> - anywhere else is silently ignored, so that wrapper is
	 * located (or created) instead of appending to the document root.
	 */
	function permissionParent() {
		const root = doc.documentElement;
		if (!isConfigXml) return root;

		let platform = Array.from(root.getElementsByTagName("platform")).find(
			(el) => el.getAttribute("name") === "android",
		);
		if (!platform) {
			platform = doc.createElementNS(root.namespaceURI, "platform");
			platform.setAttribute("name", "android");
			root.appendChild(platform);
		}

		let configFile = Array.from(
			platform.getElementsByTagName("config-file"),
		).find(
			(el) =>
				el.getAttribute("target") === "AndroidManifest.xml" &&
				el.getAttribute("parent") === "/manifest",
		);
		if (!configFile) {
			configFile = doc.createElementNS(root.namespaceURI, "config-file");
			configFile.setAttribute("target", "AndroidManifest.xml");
			configFile.setAttribute("parent", "/manifest");
			platform.appendChild(configFile);
		}

		return configFile;
	}

	function render() {
		$form.textContent = "";

		const root = doc.documentElement;
		const idAttr = isConfigXml ? "id" : "package";
		const versionAttr = isConfigXml ? "version" : "versionName";

		const $idInput = (
			<input type="text" value={root.getAttribute(idAttr) || ""}></input>
		);
		const $versionInput = (
			<input type="text" value={root.getAttribute(versionAttr) || ""}></input>
		);

		$idInput.addEventListener("change", () => {
			root.setAttribute(idAttr, $idInput.value.trim());
		});
		$versionInput.addEventListener("change", () => {
			root.setAttribute(versionAttr, $versionInput.value.trim());
		});

		const permissionNodes = Array.from(
			doc.getElementsByTagName("uses-permission"),
		);

		const $permissionsList = <div className="me-permissions"></div>;
		renderPermissions($permissionsList, permissionNodes);

		const $addPermissionButton = (
			<button type="button" className="me-add-permission">
				+ Add permission
			</button>
		);
		$addPermissionButton.addEventListener("click", async () => {
			const name = await prompt("Permission", "", "text", {
				placeholder: "android.permission.CAMERA",
			});
			if (!name?.trim()) return;
			const el = doc.createElementNS(root.namespaceURI, "uses-permission");
			el.setAttributeNS(ANDROID_NS, "android:name", name.trim());
			permissionParent().appendChild(el);
			renderPermissions(
				$permissionsList,
				Array.from(doc.getElementsByTagName("uses-permission")),
			);
		});

		$form.append(
			<div className="me-field">
				<span className="me-label">
					{isConfigXml ? "App ID" : "Package name"}
				</span>
				{$idInput}
			</div>,
			<div className="me-field">
				<span className="me-label">Version</span>
				{$versionInput}
			</div>,
			<div className="me-section-label">
				Permissions ({permissionNodes.length})
			</div>,
			$permissionsList,
			$addPermissionButton,
		);
	}

	function renderPermissions(container, nodes) {
		container.textContent = "";
		if (!nodes.length) {
			container.append(<div className="me-empty">None declared.</div>);
			return;
		}
		container.append(
			...nodes.map((node) => {
				const name =
					node.getAttributeNS(ANDROID_NS, "name") || node.getAttribute("name");
				return (
					<div className="me-permission-row">
						<span className="me-permission-name">{name}</span>
						<button
							type="button"
							className="me-remove-permission"
							onclick={() => {
								node.remove();
								renderPermissions(
									container,
									Array.from(doc.getElementsByTagName("uses-permission")),
								);
							}}
						>
							<span className="icon delete_outline"></span>
						</button>
					</div>
				);
			}),
		);
	}

	$saveButton.addEventListener("click", async () => {
		if (!doc || !fileUrl) return;
		const confirmed = await confirm(
			strings.warning || "Warning",
			`Save changes to ${Url.basename(fileUrl)}?`,
		);
		if (!confirmed) return;

		try {
			const serialized = new XMLSerializer().serializeToString(doc);
			await fsOperation(fileUrl).writeFile(serialized);
			toast("Saved.");
		} catch (error) {
			toast(`Couldn't save: ${error?.message || error}`);
		}
	});
}
