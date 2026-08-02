const { JWT } = require("google-auth-library");

const PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

let cachedClient = null;

function getServiceAccountCredentials() {
	// Either the whole service account JSON as one env var, or split into two
	// (handy since some hosts mangle multi-line env values) - either works.
	const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
	if (rawJson) {
		const parsed = JSON.parse(rawJson);
		return { client_email: parsed.client_email, private_key: parsed.private_key };
	}

	const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
	const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
	if (clientEmail && privateKey) {
		// Env vars can't hold real newlines - the key is stored with literal
		// "\n" sequences and unescaped here.
		return { client_email: clientEmail, private_key: privateKey.replace(/\\n/g, "\n") };
	}

	return null;
}

function getClient() {
	if (cachedClient) return cachedClient;

	const credentials = getServiceAccountCredentials();
	if (!credentials) {
		throw new Error(
			"Google Play verification isn't configured - set GOOGLE_SERVICE_ACCOUNT_JSON " +
				"(or GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).",
		);
	}

	cachedClient = new JWT({
		email: credentials.client_email,
		key: credentials.private_key,
		scopes: [PLAY_SCOPE],
	});
	return cachedClient;
}

/**
 * Verifies a one-time product purchase token against the Google Play
 * Developer API. Returns the purchase record if it's genuinely paid and
 * not refunded/cancelled, or null otherwise - never trust a token's
 * presence alone, only this server-side check.
 * @param {{packageName: string, productId: string, token: string}} options
 * @returns {Promise<{orderId: string, purchaseTimeMillis: string} | null>}
 */
async function verifyPlayPurchase({ packageName, productId, token }) {
	const client = getClient();
	const url =
		`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
		`${encodeURIComponent(packageName)}/purchases/products/` +
		`${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;

	const response = await client.request({ url });
	const purchase = response.data;

	// purchaseState: 0 = purchased, 1 = cancelled, 2 = pending.
	if (purchase.purchaseState !== 0) return null;

	return {
		orderId: purchase.orderId,
		purchaseTimeMillis: purchase.purchaseTimeMillis,
	};
}

module.exports = { verifyPlayPurchase };
