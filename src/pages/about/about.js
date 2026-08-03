import "./about.scss";
import goatechLogo from "./goatech-logo.jpeg";
import Logo from "components/logo";
import Page from "components/page";
import Reactive from "html-tag-js/reactive";
import actionStack from "lib/actionStack";
import { hideAd } from "lib/startAd";
import helpers from "utils/helpers";
export default function AboutInclude() {
	const $page = Page(strings.about.capitalize());
	const webviewVersionName = Reactive("N/A");
	const webviewPackageName = Reactive("N/A");

	$page.classList.add("about-us");
	$page.body = (
		<main id="about-page" className="main scroll">
			<Logo />

			<div className="version-info">
				<h1 className="version-title">Nothing IDE</h1>
				<div className="version-number">
					Version {BuildInfo.version} ({BuildInfo.versionCode})
				</div>
			</div>

			<div className="info-section">
				<a
					href="#"
					className="info-item"
					onclick={(e) => {
						e.preventDefault();
						system.openInBrowser(
							`https://play.google.com/store/apps/details?id=${webviewPackageName.value}`,
						);
					}}
				>
					<div className="info-item-icon">
						<span className="icon googlechrome"></span>
					</div>
					<div className="info-item-text">
						Webview {webviewVersionName}
						<div className="info-item-subtext">{webviewPackageName}</div>
					</div>
				</a>
			</div>

			<div className="created-by">
				<a
					href="#"
					onclick={(e) => {
						e.preventDefault();
						system.openInBrowser("https://goatech.tech");
					}}
				>
					<img src={goatechLogo} alt="GOAT'ECH" className="goatech-logo" />
				</a>
				<div className="created-by-text">Created by GOAT'ECH</div>
			</div>
		</main>
	);

	system.getWebviewInfo((res) => {
		webviewPackageName.value = res?.packageName || "N/A";
		webviewVersionName.value = res?.versionName || "N/A";
	});

	actionStack.push({
		id: "about",
		action: $page.hide,
	});

	$page.onhide = function () {
		actionStack.remove("about");
		hideAd();
	};

	app.append($page);
	helpers.showAd();
}
