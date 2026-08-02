import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";

/**
 * A helper screen for connecting a PC to this device over Wi-Fi for ADB -
 * not a full ADB client (that only runs on a desktop), just what an
 * Android app can actually do: jump to Developer Options and show the
 * steps and (best-effort) local IP address.
 */
export default function WirelessDebug() {
	const $page = Page("Wireless Debugging");

	const $ipValue = <span className="ip-value">Detecting...</span>;

	const $content = (
		<div id="wireless-debug">
			<p className="wd-intro">
				Wireless debugging lets a computer install and inspect this app over
				Wi-Fi, without a USB cable. Both devices must be on the same network.
			</p>

			<div className="wd-ip-row">
				<span className="wd-ip-label">This device's local IP:</span>
				{$ipValue}
			</div>

			<button
				type="button"
				className="action-button"
				onclick={() => openDeveloperOptions()}
			>
				<span className="icon settings"></span> Open Developer Options
			</button>

			<ol className="wd-steps">
				<li>
					Tap the button above, then find and enable{" "}
					<strong>Wireless debugging</strong> in Developer Options (Android 11+
					only).
				</li>
				<li>
					Inside Wireless debugging, tap{" "}
					<strong>Pair device with pairing code</strong> - it shows an IP, port,
					and a 6-digit code.
				</li>
				<li>
					On your computer, run{" "}
					<code>adb pair &lt;ip&gt;:&lt;port&gt; &lt;code&gt;</code> with the
					values shown.
				</li>
				<li>
					Then run <code>adb connect &lt;ip&gt;:&lt;port&gt;</code> using the IP
					and port shown on the main Wireless debugging screen (this is a
					different port than the pairing one).
				</li>
			</ol>
		</div>
	);

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		actionStack.remove("wireless-debug");
	};
	actionStack.push({ id: "wireless-debug", action: $page.hide });

	detectLocalIp().then((ip) => {
		$ipValue.textContent = ip || "Not available on this device";
		if (!ip) {
			$ipValue.title =
				"Android's privacy protections hide this from apps on some devices/versions. Check your Wi-Fi settings for the IP instead.";
		}
	});

	function openDeveloperOptions() {
		window.system?.openDeveloperOptions?.(
			() => {},
			() => {
				toast("Couldn't open Developer Options on this device.");
			},
		);
	}
}

/**
 * Best-effort local IP detection via a WebRTC ICE candidate (no network
 * permission needed). Modern WebView/Chrome versions often hide the real
 * local IP behind an mDNS ".local" hostname for privacy, in which case this
 * resolves to null and the UI falls back to telling the user to check
 * their Wi-Fi settings instead.
 * @returns {Promise<string|null>}
 */
function detectLocalIp() {
	return new Promise((resolve) => {
		if (typeof RTCPeerConnection !== "function") {
			resolve(null);
			return;
		}

		let settled = false;
		const finish = (ip) => {
			if (settled) return;
			settled = true;
			resolve(ip);
			pc.close();
		};

		const pc = new RTCPeerConnection({ iceServers: [] });
		pc.createDataChannel("");

		pc.onicecandidate = (event) => {
			if (!event.candidate) {
				finish(null);
				return;
			}
			const match = event.candidate.candidate.match(
				/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/,
			);
			if (match && !match[1].startsWith("127.")) {
				finish(match[1]);
			}
		};

		pc.createOffer()
			.then((offer) => pc.setLocalDescription(offer))
			.catch(() => finish(null));

		setTimeout(() => finish(null), 2000);
	});
}
