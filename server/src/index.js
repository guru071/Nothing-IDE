const express = require("express");
const path = require("node:path");
const fs = require("node:fs");

const DATA_DIR = path.join(__dirname, "..", "data");
const PLUGINS_JSON = path.join(DATA_DIR, "plugins.json");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
const PLUGINS_STATIC_DIR = path.join(DATA_DIR, "plugins");

const PORT = process.env.PORT || 3000;

const app = express();
// Both Render and Vercel sit behind a proxy that terminates TLS and forwards
// the real scheme via X-Forwarded-Proto; without this, req.protocol always
// reports "http" and icon URLs get built wrong (mixed-content on an https page).
app.set("trust proxy", true);
app.use(express.json());

// CORS: the app running on a phone has no origin restrictions to worry
// about, but allow browser-based testing (e.g. curl/Postman/dev tools) too.
app.use((req, res, next) => {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type");
	if (req.method === "OPTIONS") return res.sendStatus(204);
	next();
});

function loadPlugins() {
	const raw = fs.readFileSync(PLUGINS_JSON, "utf8");
	return JSON.parse(raw);
}

/** Strips server-only fields (like the download filename) before sending a
 * plugin object to the client, and rewrites relative "icon" paths into
 * absolute URLs using this request's own protocol+host - the client renders
 * icons inside the app, not on this server's origin, so a bare "/static/..."
 * path would never resolve there. This also means the server doesn't need to
 * know its own public domain hardcoded anywhere: it reads it off each request. */
function toPublic(plugin, req) {
	const { file, ...pub } = plugin;
	if (pub.icon?.startsWith("/")) {
		pub.icon = `${req.protocol}://${req.get("host")}${pub.icon}`;
	}
	return pub;
}

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

function paginate(items, page, limit) {
	const p = Math.max(1, Number.parseInt(page, 10) || 1);
	const l = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 50));
	const start = (p - 1) * l;
	return items.slice(start, start + l);
}

function shuffled(items) {
	const arr = items.slice();
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

/** GET /api/plugins and GET /api/plugin - list/search/filter/paginate. */
function listHandler(req, res) {
	const { page = 1, limit = 50, name, explore, orderBy, owned } = req.query;
	let plugins = loadPlugins();

	// No accounts in this server: nothing is ever "owned" via purchase.
	if (owned === "true") {
		return res.json([]);
	}

	if (name) {
		const q = String(name).toLowerCase();
		plugins = plugins.filter((p) => p.name.toLowerCase().includes(q));
	}

	if (explore === "random") {
		plugins = shuffled(plugins);
	} else if (orderBy === "downloads") {
		plugins = plugins.slice().sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
	} else if (orderBy === "newest") {
		plugins = plugins.slice().reverse();
	}
	// orderBy === "top_rated" has no rating data in this simple server; falls
	// through to insertion order, same as the default listing.

	const page_ = paginate(plugins, page, limit).map((p) => toPublic(p, req));
	res.json(page_);
}

app.get("/api/plugins", listHandler);
app.get("/api/plugin", listHandler);

/** GET /api/plugin/:id - single plugin's full metadata. */
app.get("/api/plugin/:id", (req, res) => {
	const plugins = loadPlugins();
	const plugin = plugins.find((p) => p.id === req.params.id);
	if (!plugin) return res.status(404).json({ error: "Plugin not found" });
	res.json(toPublic(plugin, req));
});

/** GET /api/plugin/download/:id - serves the plugin's zip archive. */
app.get("/api/plugin/download/:id", (req, res) => {
	const plugins = loadPlugins();
	const plugin = plugins.find((p) => p.id === req.params.id);
	if (!plugin) return res.status(404).json({ error: "Plugin not found" });

	const zipPath = path.join(DOWNLOADS_DIR, plugin.file);
	if (!fs.existsSync(zipPath)) {
		return res.status(404).json({ error: "Plugin archive missing on server" });
	}

	bumpDownloadCount(plugin.id);

	res.type("application/zip");
	res.sendFile(zipPath);
});

/** Increments and persists a plugin's download counter. */
function bumpDownloadCount(id) {
	const plugins = loadPlugins();
	const target = plugins.find((p) => p.id === id);
	if (!target) return;
	target.downloads = (target.downloads || 0) + 1;
	fs.writeFileSync(PLUGINS_JSON, JSON.stringify(plugins, null, "\t"));
}

/** GET /api/plugin/check-update/:id/:version */
app.get("/api/plugin/check-update/:id/:version", (req, res) => {
	const plugins = loadPlugins();
	const plugin = plugins.find((p) => p.id === req.params.id);
	if (!plugin) return res.json({ update: false });

	const update = isVersionGreater(plugin.version, req.params.version);
	res.json({ update, version: plugin.version });
});

/** POST /api/plugin/order - no-op: this server has no paid plugins/accounts. */
app.post("/api/plugin/order", (req, res) => {
	res.json({ success: true });
});

// Plugin icons and other static assets referenced by plugins.json's "icon"
// field (e.g. "/static/plugins/hello-world/icon.png").
app.use("/static/plugins", express.static(PLUGINS_STATIC_DIR));

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
