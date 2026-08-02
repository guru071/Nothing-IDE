import { createClient } from "@supabase/supabase-js";

// The Supabase project's URL and publishable ("anon") key - safe to embed
// client-side by design (unlike the secret key, which only ever lives on
// the server). This talks to Supabase Auth directly; plugin data itself
// still goes through our own server (lib/config.js's BASE_URL), not here.
const SUPABASE_URL = "https://qzctapmcjzwyvgtjryqa.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
	"sb_publishable_Y8LZKAM-oWA2wuUvp_Pjaw_kHaG1lTn";

const OAUTH_REDIRECT_URL = "nothing://auth/callback";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: false, // this is a Cordova app, not a browser tab
	},
});

/**
 * Starts the OAuth sign-in flow for a provider by opening Supabase's
 * hosted authorize URL in the system browser (Custom Tabs) - the redirect
 * back into the app (nothing://auth/callback#access_token=...) is picked
 * up by handleAuthCallbackUrl below, wired from the native intent handler.
 * @param {"github"|"google"} provider
 */
async function signInWithProvider(provider) {
	const { data, error } = await supabase.auth.signInWithOAuth({
		provider,
		options: {
			redirectTo: OAUTH_REDIRECT_URL,
			skipBrowserRedirect: true,
		},
	});
	if (error) throw error;

	const { default: customTab } = await import("./customTab");
	await customTab(data.url);
}

/**
 * Call this with the full callback URL once the native side forwards a
 * nothing://auth/callback intent - extracts the access/refresh tokens
 * Supabase appended as a URL fragment and establishes the session.
 * @param {string} url
 */
async function handleAuthCallbackUrl(url) {
	const fragment = url.split("#")[1] || "";
	const params = new URLSearchParams(fragment);
	const accessToken = params.get("access_token");
	const refreshToken = params.get("refresh_token");
	if (!accessToken || !refreshToken) return false;

	const { error } = await supabase.auth.setSession({
		access_token: accessToken,
		refresh_token: refreshToken,
	});
	return !error;
}

async function getSession() {
	const { data } = await supabase.auth.getSession();
	return data.session || null;
}

/** The Bearer token to send as `Authorization` on API_BASE requests, or
 * null if signed out - never throws, just returns null on any failure. */
async function getAccessToken() {
	try {
		const session = await getSession();
		return session?.access_token || null;
	} catch {
		return null;
	}
}

// Kept in sync with the real session (below) so ajax.configure in main.js -
// which XHR requires to run synchronously, right before xhr.send() - can
// attach an Authorization header without awaiting a Promise on every request.
let cachedAccessToken = null;

supabase.auth.onAuthStateChange((_event, session) => {
	cachedAccessToken = session?.access_token || null;
});
// Primes the cache immediately: onAuthStateChange alone wouldn't fire until
// the *next* change, so a fresh launch with an already-persisted session
// would otherwise look signed-out to getAccessTokenSync() until then.
supabase.auth.getSession().then(({ data }) => {
	cachedAccessToken = data.session?.access_token || null;
});

/** Synchronous counterpart to getAccessToken - may lag a real session change
 * by a moment, but that's fine for attaching a header, unlike the async
 * version used right before an actual purchase. */
function getAccessTokenSync() {
	return cachedAccessToken;
}

function getUser() {
	return supabase.auth.getUser().then(
		(result) => result.data.user || null,
		() => null,
	);
}

async function signOut() {
	await supabase.auth.signOut();
}

/**
 * @param {(user: import("@supabase/supabase-js").User | null) => void} callback
 * @returns {() => void} unsubscribe
 */
function onAuthStateChange(callback) {
	const { data } = supabase.auth.onAuthStateChange((_event, session) => {
		callback(session?.user || null);
	});
	return () => data.subscription.unsubscribe();
}

export default {
	signInWithProvider,
	handleAuthCallbackUrl,
	getSession,
	getAccessToken,
	getAccessTokenSync,
	getUser,
	signOut,
	onAuthStateChange,
};
