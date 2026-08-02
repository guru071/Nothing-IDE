const crypto = require("crypto");
const Razorpay = require("razorpay");

let cachedClient = null;

function getCredentials() {
	const keyId = process.env.RAZORPAY_KEY_ID;
	const keySecret = process.env.RAZORPAY_KEY_SECRET;
	if (!keyId || !keySecret) {
		throw new Error(
			"Razorpay isn't configured - set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
		);
	}
	return { keyId, keySecret };
}

function getClient() {
	if (cachedClient) return cachedClient;
	const { keyId, keySecret } = getCredentials();
	cachedClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
	return cachedClient;
}

/** The Key ID is safe to hand to the client (it's what Razorpay's own
 * Checkout SDKs expect to receive) - only the Key Secret must stay
 * server-only, used below for signature verification. */
function getPublicKeyId() {
	return getCredentials().keyId;
}

/**
 * Creates a Razorpay order for a plugin purchase. `amount` is in the
 * smallest currency unit (paise for INR), matching Razorpay's own API.
 * @param {{amount: number, currency?: string, receipt: string}} options
 */
async function createOrder({ amount, currency = "INR", receipt }) {
	const client = getClient();
	return client.orders.create({ amount, currency, receipt });
}

/**
 * Verifies a completed payment's signature against our Key Secret - this is
 * the actual proof the payment happened and wasn't tampered with, never
 * trust the client's claimed success alone.
 * @param {{orderId: string, paymentId: string, signature: string}} options
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
	const { keySecret } = getCredentials();
	const expected = crypto
		.createHmac("sha256", keySecret)
		.update(`${orderId}|${paymentId}`)
		.digest("hex");

	const expectedBuffer = Buffer.from(expected, "hex");
	const providedBuffer = Buffer.from(String(signature || ""), "hex");
	if (expectedBuffer.length !== providedBuffer.length) return false;
	return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

module.exports = { createOrder, verifyPaymentSignature, getPublicKeyId };
