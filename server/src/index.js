const path = require("node:path");
const express = require("express");
const multer = require("multer");
const { getUserFromRequest, requireUser } = require("./auth");
const { verifyPlayPurchase } = require("./playBilling");
const razorpay = require("./razorpay");
const pluginsRepo = require("./pluginsRepo");
const { renderUploadPage } = require("./uploadPage");

const PORT = process.env.PORT || 3000;
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 25 * 1024 * 1024 },
});

const app = express();
// Both Render and Vercel sit behind a proxy that terminates TLS and forwards
// the real scheme via X-Forwarded-Proto; without this, req.protocol always
// reports "http" and icon URLs get built wrong (mixed-content on an https page).
app.set("trust proxy", true);
app.use(express.json());
// Serves server/public/brand-icon.png (the app logo shown inside the native
// Razorpay checkout sheet) and anything else dropped in that folder later.
app.use(express.static(path.join(__dirname, "..", "public")));

// CORS: the app running on a phone has no origin restrictions to worry
// about, but allow browser-based testing (e.g. curl/Postman/dev tools) too.
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type, x-admin-token, Authorization");
	if (req.method === "OPTIONS") return res.sendStatus(204);
	next();
});

function sendError(res, status, error) {
	res.status(status).json({ error: String(error?.message || error) });
}

/** GET /api/plugins and GET /api/plugin - list/search/filter/paginate. */
async function listHandler(req, res) {
	const { page = 1, limit = 50, name, explore, orderBy, owned } = req.query;

	try {
		if (owned === "true") {
			// Anonymous callers (no/invalid Bearer token) simply own nothing,
			// same as before accounts existed - this never errors on its own.
			const user = await getUserFromRequest(req);
			if (!user) return res.json([]);

			const ownedIds = await pluginsRepo.getOwnedPluginIds(user.id);
			const plugins = await pluginsRepo.listPlugins({ name, orderBy, explore });
			return res.json(plugins.filter((plugin) => ownedIds.has(plugin.id)));
		}

		const plugins = await pluginsRepo.listPlugins({ name, orderBy, explore });
		const p = Math.max(1, Number.parseInt(page, 10) || 1);
		const l = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));
		const start = (p - 1) * l;
		res.json(plugins.slice(start, start + l));
	} catch (error) {
		sendError(res, 500, error);
	}
}

app.get("/api/plugins", listHandler);
app.get("/api/plugin", listHandler);

/** GET /api/status - the app pings this before showing the marketplace to
 * decide whether to show "API server down" instead of the plugin list. */
app.get("/api/status", (req, res) => {
	res.json({ status: "ok" });
});

/** GET /api/plugin/:id - single plugin's full metadata. */
app.get("/api/plugin/:id", async (req, res) => {
	try {
		const plugin = await pluginsRepo.getPlugin(req.params.id);
		if (!plugin) return res.status(404).json({ error: "Plugin not found" });
		res.json(plugin);
	} catch (error) {
		sendError(res, 500, error);
	}
});

/** GET /api/plugin/download/:id - redirects to the plugin's zip in Supabase Storage. */
app.get("/api/plugin/download/:id", async (req, res) => {
	try {
		const plugin = await pluginsRepo.getPluginDownload(req.params.id);
		if (!plugin) return res.status(404).json({ error: "Plugin not found" });

		await pluginsRepo.bumpDownloads(plugin.id);
		res.redirect(plugin.downloadUrl);
	} catch (error) {
		sendError(res, 500, error);
	}
});

/** GET /api/plugin/check-update/:id/:version */
app.get("/api/plugin/check-update/:id/:version", async (req, res) => {
	try {
		const currentVersion = await pluginsRepo.getVersion(req.params.id);
		if (!currentVersion) return res.json({ update: false });

		const update = isVersionGreater(currentVersion, req.params.version);
		res.json({ update, version: currentVersion });
	} catch (error) {
		sendError(res, 500, error);
	}
});

/** Simple dot-separated numeric version comparison: returns true if `a` > `b`. */
function isVersionGreater(a, b) {
	const pa = String(a || "0").split(".").map(Number);
	const pb = String(b || "0").split(".").map(Number);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const na = pa[i] || 0;
		const nb = pb[i] || 0;
		if (na > nb) return true;
		if (na < nb) return false;
	}
	return false;
}

/** POST /api/plugin/order - verifies a Google Play purchase token for a
 * paid plugin and, once genuinely confirmed with Google (never trust the
 * client's say-so alone), records ownership for the signed-in user. */
app.post("/api/plugin/order", requireUser, async (req, res) => {
	try {
		const { id, token, package: packageName } = req.body || {};
		if (!id || !token || !packageName) {
			return sendError(res, 400, "id, token, and package are required.");
		}

		const plugin = await pluginsRepo.getPluginRaw(id);
		if (!plugin) return sendError(res, 404, "Plugin not found");
		if (!plugin.sku) {
			return sendError(res, 400, "This plugin has no Google Play product configured.");
		}

		const purchase = await verifyPlayPurchase({
			packageName,
			productId: plugin.sku,
			token,
		});
		if (!purchase) {
			return sendError(res, 402, "Purchase could not be verified with Google Play.");
		}

		await pluginsRepo.recordPurchase({
			userId: req.user.id,
			pluginId: id,
			playPurchaseToken: token,
			playOrderId: purchase.orderId,
			amount: Number(plugin.price) || 0,
			currency: "usd",
		});

		res.json({ success: true });
	} catch (error) {
		sendError(res, 500, error);
	}
});

/** POST /api/plugin/razorpay/order - creates a Razorpay order for a paid
 * plugin, for the non-Play-Store purchase path (native Razorpay checkout).
 * Records who it's for so /verify below can confirm the payment belongs to
 * the same signed-in user before recording ownership. */
app.post("/api/plugin/razorpay/order", requireUser, async (req, res) => {
	try {
		const { id } = req.body || {};
		if (!id) return sendError(res, 400, "id is required.");

		const plugin = await pluginsRepo.getPluginRaw(id);
		if (!plugin) return sendError(res, 404, "Plugin not found");

		const price = Number(plugin.price) || 0;
		if (price <= 0) return sendError(res, 400, "This plugin is free.");

		const order = await razorpay.createOrder({
			amount: Math.round(price * 100),
			currency: "INR",
			receipt: `plugin_${id}_${req.user.id}_${Date.now()}`,
		});

		await pluginsRepo.createPendingRazorpayOrder({
			orderId: order.id,
			userId: req.user.id,
			pluginId: id,
			amount: price,
			currency: "inr",
		});

		res.json({
			orderId: order.id,
			amount: order.amount,
			currency: order.currency,
			keyId: razorpay.getPublicKeyId(),
			name: plugin.name,
		});
	} catch (error) {
		sendError(res, 500, error);
	}
});

/** POST /api/plugin/razorpay/verify - confirms a completed native checkout's
 * signature, checks the order was actually created for this same user (a
 * valid signature alone only proves the order/payment pair is genuine, not
 * who's allowed to claim it), then records ownership. */
app.post("/api/plugin/razorpay/verify", requireUser, async (req, res) => {
	try {
		const { orderId, paymentId, signature } = req.body || {};
		if (!orderId || !paymentId || !signature) {
			return sendError(res, 400, "orderId, paymentId, and signature are required.");
		}

		if (!razorpay.verifyPaymentSignature({ orderId, paymentId, signature })) {
			return sendError(res, 402, "Payment signature could not be verified.");
		}

		const pending = await pluginsRepo.consumePendingRazorpayOrder(orderId);
		if (!pending) {
			return sendError(res, 404, "No matching order found (already used or never created).");
		}
		if (pending.user_id !== req.user.id) {
			return sendError(res, 403, "This order wasn't created by the signed-in user.");
		}

		await pluginsRepo.recordPurchase({
			userId: req.user.id,
			pluginId: pending.plugin_id,
			razorpayOrderId: orderId,
			razorpayPaymentId: paymentId,
			amount: pending.amount,
			currency: pending.currency,
		});

		res.json({ success: true, id: pending.plugin_id });
	} catch (error) {
		sendError(res, 500, error);
	}
});

function requireAdminToken(req, res, next) {
	const configuredToken = process.env.UPLOAD_ADMIN_TOKEN;
	if (!configuredToken) {
		return sendError(res, 500, "Server has no UPLOAD_ADMIN_TOKEN configured.");
	}
	const providedToken = req.headers["x-admin-token"];
	if (providedToken !== configuredToken) {
		return sendError(res, 401, "Invalid or missing upload token.");
	}
	next();
}

/** GET /upload - the browser-based publish form (like a mini VS Code Marketplace). */
app.get("/upload", (req, res) => {
	res.type("html").send(renderUploadPage());
});

/** POST /api/admin/plugins - publishes (or republishes) a plugin: uploads its
 * icon + zip to Supabase Storage and upserts its metadata row. Gated by
 * UPLOAD_ADMIN_TOKEN so this isn't a public, unauthenticated write endpoint. */
app.post(
	"/api/admin/plugins",
	requireAdminToken,
	upload.fields([
		{ name: "icon", maxCount: 1 },
		{ name: "zip", maxCount: 1 },
	]),
	async (req, res) => {
		try {
			const {
				id,
				name,
				description,
				version,
				author,
				license,
				keywords,
				changelogs,
				price,
				sku,
			} = req.body;

			if (!id || !/^[a-z0-9-]+$/.test(id)) {
				return sendError(res, 400, "id is required and must be lowercase-kebab-case.");
			}
			if (!name || !version) {
				return sendError(res, 400, "name and version are required.");
			}

			const iconFile = req.files?.icon?.[0];
			const zipFile = req.files?.zip?.[0];
			if (!iconFile || !zipFile) {
				return sendError(res, 400, "Both an icon and a plugin zip file are required.");
			}

			const iconPath = `icons/${id}.png`;
			const filePath = `downloads/${id}.zip`;
			await pluginsRepo.uploadAsset(iconPath, iconFile.buffer, "image/png");
			await pluginsRepo.uploadAsset(filePath, zipFile.buffer, "application/zip");

			await pluginsRepo.upsertPlugin({
				id,
				name,
				description: description || "",
				author: author || "Nothing IDE",
				author_verified: true,
				license: license || "MIT",
				version,
				keywords: keywords
					? keywords.split(",").map((k) => k.trim()).filter(Boolean)
					: [],
				changelogs: changelogs || `## ${version}\n\nInitial release.`,
				supported_editor: "cm",
				price: Number(price) || 0,
				currency_symbol: "$",
				// Required for a non-zero price: must already exist as a one-time
				// product in the Google Play Console for this app.
				sku: sku || null,
				icon_path: iconPath,
				file_path: filePath,
			});

			res.json({ success: true, id });
		} catch (error) {
			sendError(res, 500, error);
		}
	},
);

app.get("/", (req, res) => {
	res.type("text/plain").send("Nothing IDE plugin marketplace server is running.");
});

// When run directly (`npm start`, or on Render/any long-running host) bind to
// a port. On Vercel this file is required by api/index.js as a serverless
// function handler instead, so it must not call listen() there.
if (require.main === module) {
	app.listen(PORT, () => {
		console.log(`Plugin marketplace server listening on port ${PORT}`);
	});
}

module.exports = app;
