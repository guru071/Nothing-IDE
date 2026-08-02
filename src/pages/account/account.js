import "./style.scss";
import Page from "components/page";
import toast from "components/toast";
import actionStack from "lib/actionStack";
import auth from "lib/auth";

export default function Account() {
	const $page = Page("Account");
	const $content = <div id="account-page"></div>;

	$page.body = $content;
	app.append($page);

	$page.onhide = function () {
		unsubscribe();
		actionStack.remove("account");
	};
	actionStack.push({ id: "account", action: $page.hide });

	const unsubscribe = auth.onAuthStateChange(render);

	auth.getUser().then(render);

	function render(user) {
		$content.textContent = "";

		if (user) {
			$content.append(
				<div className="account-signed-in">
					<div className="account-avatar">
						{(user.email || "?")[0].toUpperCase()}
					</div>
					<div className="account-email">{user.email || "Signed in"}</div>
					<button
						type="button"
						className="action-button secondary"
						onclick={signOut}
					>
						Sign Out
					</button>
				</div>,
			);
			return;
		}

		$content.append(
			<div className="account-signed-out">
				<p className="account-intro">
					Sign in to buy paid plugins and keep your purchases if you switch
					devices.
				</p>
				<button
					type="button"
					className="action-button"
					onclick={() => signIn("github")}
				>
					Sign in with GitHub
				</button>
				<button
					type="button"
					className="action-button"
					onclick={() => signIn("google")}
				>
					Sign in with Google
				</button>
			</div>,
		);
	}

	async function signIn(provider) {
		try {
			await auth.signInWithProvider(provider);
		} catch (error) {
			toast(`Sign-in failed: ${error?.message || error}`);
		}
	}

	async function signOut() {
		await auth.signOut();
		toast("Signed out.");
	}
}
