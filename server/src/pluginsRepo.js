const { supabase, PLUGIN_ASSETS_BUCKET } = require("./supabaseClient");

function requireSupabase() {
	if (!supabase) {
		throw new Error(
			"Supabase isn't configured - set SUPABASE_URL and SUPABASE_SECRET_KEY.",
		);
	}
	return supabase;
}

function shuffled(items) {
	const arr = items.slice();
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function getPublicUrl(bucketPath) {
	const client = requireSupabase();
	const { data } = client.storage.from(PLUGIN_ASSETS_BUCKET).getPublicUrl(bucketPath);
	return data.publicUrl;
}

/** Shapes a database row into exactly what the Nothing IDE app's marketplace
 * client expects. Ownership isn't included here - the listHandler filters
 * by the caller's real purchases (see getOwnedPluginIds) when a signed-in
 * user is making the request. */
function toPublicPlugin(row) {
	return {
		id: row.id,
		name: row.name,
		icon: getPublicUrl(row.icon_path),
		version: row.version,
		license: row.license,
		author: row.author,
		author_verified: row.author_verified,
		price: Number(row.price) || 0,
		currencySymbol: row.currency_symbol,
		downloads: row.downloads,
		keywords: row.keywords || [],
		description: row.description,
		changelogs: row.changelogs,
		supported_editor: row.supported_editor,
		min_version_code: null,
		sku: row.sku || null,
	};
}

async function listPlugins({ name, orderBy, explore } = {}) {
	const client = requireSupabase();
	let query = client.from("plugins").select("*");

	if (name) {
		query = query.ilike("name", `%${name}%`);
	}

	if (orderBy === "downloads") {
		query = query.order("downloads", { ascending: false });
	} else if (orderBy === "newest") {
		query = query.order("created_at", { ascending: false });
	} else {
		query = query.order("created_at", { ascending: true });
	}
	// orderBy === "top_rated" has no rating data in this simple server; falls
	// through to insertion order, same as the default listing.

	const { data, error } = await query;
	if (error) throw error;

	const rows = explore === "random" ? shuffled(data) : data;
	return rows.map(toPublicPlugin);
}

async function getPlugin(id) {
	const client = requireSupabase();
	const { data, error } = await client
		.from("plugins")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	if (error) throw error;
	return data ? toPublicPlugin(data) : null;
}

/** Returns the plugin's row (with file_path, unlike getPlugin) plus its
 * public download URL, or null if it doesn't exist. */
async function getPluginDownload(id) {
	const client = requireSupabase();
	const { data, error } = await client
		.from("plugins")
		.select("id, version, file_path")
		.eq("id", id)
		.maybeSingle();
	if (error) throw error;
	if (!data) return null;
	return { ...data, downloadUrl: getPublicUrl(data.file_path) };
}

async function bumpDownloads(id) {
	const client = requireSupabase();
	const { error } = await client.rpc("increment_plugin_downloads", {
		plugin_id: id,
	});
	if (error) throw error;
}

async function getVersion(id) {
	const client = requireSupabase();
	const { data, error } = await client
		.from("plugins")
		.select("version")
		.eq("id", id)
		.maybeSingle();
	if (error) throw error;
	return data?.version || null;
}

async function uploadAsset(bucketPath, buffer, contentType) {
	const client = requireSupabase();
	const { error } = await client.storage
		.from(PLUGIN_ASSETS_BUCKET)
		.upload(bucketPath, buffer, { contentType, upsert: true });
	if (error) throw error;
	return bucketPath;
}

/** Creates or replaces a plugin row (upload/re-upload is the same operation -
 * publishing a new version overwrites the previous row for that id). */
async function upsertPlugin(row) {
	const client = requireSupabase();
	const { error } = await client.from("plugins").upsert(row);
	if (error) throw error;
}

/** Row for one plugin (not the public-shape one), needed by /api/checkout
 * to read its price/name without exposing icon/changelog fields. */
async function getPluginRaw(id) {
	const client = requireSupabase();
	const { data, error } = await client
		.from("plugins")
		.select("*")
		.eq("id", id)
		.maybeSingle();
	if (error) throw error;
	return data;
}

async function getOwnedPluginIds(userId) {
	const client = requireSupabase();
	const { data, error } = await client
		.from("purchases")
		.select("plugin_id")
		.eq("user_id", userId);
	if (error) throw error;
	return new Set(data.map((row) => row.plugin_id));
}

async function hasPurchased(userId, pluginId) {
	const client = requireSupabase();
	const { data, error } = await client
		.from("purchases")
		.select("id")
		.eq("user_id", userId)
		.eq("plugin_id", pluginId)
		.maybeSingle();
	if (error) throw error;
	return Boolean(data);
}

async function recordPurchase({
	userId,
	pluginId,
	playPurchaseToken,
	playOrderId,
	amount,
	currency,
}) {
	const client = requireSupabase();
	const { error } = await client.from("purchases").upsert(
		{
			user_id: userId,
			plugin_id: pluginId,
			play_purchase_token: playPurchaseToken,
			play_order_id: playOrderId,
			amount,
			currency,
		},
		{ onConflict: "user_id,plugin_id" },
	);
	if (error) throw error;
}

async function listAllRaw() {
	const client = requireSupabase();
	const { data, error } = await client
		.from("plugins")
		.select("*")
		.order("created_at", { ascending: false });
	if (error) throw error;
	return data;
}

module.exports = {
	listPlugins,
	getPlugin,
	getPluginRaw,
	getPluginDownload,
	bumpDownloads,
	getVersion,
	uploadAsset,
	upsertPlugin,
	listAllRaw,
	toPublicPlugin,
	getOwnedPluginIds,
	hasPurchased,
	recordPurchase,
};
