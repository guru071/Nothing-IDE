#!/usr/bin/env node
// Publishes every plugin in data/plugins.json through the live admin API -
// the same one /upload uses - instead of talking to Supabase directly.
// Only needs the UPLOAD_ADMIN_TOKEN you already use for /upload, not the
// Supabase secret key. Safe to re-run: publishing an existing id just
// replaces it in place (same as a version bump).
//
//   UPLOAD_ADMIN_TOKEN=... node scripts/publish-batch.js
//
// Optionally point at a different server with BASE_URL=... (defaults to
// the production Vercel deployment).

const fs = require("node:fs");
const path = require("node:path");

const DATA_DIR = path.join(__dirname, "..", "data");
const PLUGINS_JSON = path.join(DATA_DIR, "plugins.json");
const PLUGINS_DIR = path.join(DATA_DIR, "plugins");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");
const BASE_URL = process.env.BASE_URL || "https://nothing-ide-goatech-d3fa1ace.vercel.app";

async function main() {
	const token = process.env.UPLOAD_ADMIN_TOKEN;
	if (!token) {
		console.error(
			"Set UPLOAD_ADMIN_TOKEN first - the same token /upload asks for, " +
				"e.g.: UPLOAD_ADMIN_TOKEN=... node scripts/publish-batch.js",
		);
		process.exit(1);
	}

	const plugins = JSON.parse(fs.readFileSync(PLUGINS_JSON, "utf8"));
	let succeeded = 0;
	const failed = [];

	for (const plugin of plugins) {
		process.stdout.write(`Publishing ${plugin.id}... `);

		try {
			const iconPath = path.join(PLUGINS_DIR, plugin.id, "icon.png");
			const zipPath = path.join(DOWNLOADS_DIR, plugin.file);

			const form = new FormData();
			form.set("id", plugin.id);
			form.set("name", plugin.name);
			form.set("description", plugin.description || "");
			form.set("version", plugin.version || "1.0.0");
			form.set("author", plugin.author || "Nothing IDE");
			form.set("license", plugin.license || "MIT");
			form.set("keywords", (plugin.keywords || []).join(","));
			form.set("changelogs", plugin.changelogs || "");
			form.set("price", String(plugin.price || 0));
			if (plugin.sku) form.set("sku", plugin.sku);

			form.set("icon", new Blob([fs.readFileSync(iconPath)], { type: "image/png" }), "icon.png");
			form.set("zip", new Blob([fs.readFileSync(zipPath)], { type: "application/zip" }), plugin.file);

			const res = await fetch(`${BASE_URL}/api/admin/plugins`, {
				method: "POST",
				headers: { "x-admin-token": token },
				body: form,
			});

			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

			succeeded++;
			console.log("done.");
		} catch (error) {
			failed.push({ id: plugin.id, error: error.message });
			console.log(`FAILED: ${error.message}`);
		}
	}

	console.log(`\n${succeeded}/${plugins.length} plugins published.`);
	if (failed.length > 0) {
		console.log("Failed:");
		for (const f of failed) console.log(`  - ${f.id}: ${f.error}`);
		process.exit(1);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
