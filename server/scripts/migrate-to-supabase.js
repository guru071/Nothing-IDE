#!/usr/bin/env node
// One-time migration: uploads the existing data/plugins.json entries (and
// their icon/zip files) into Supabase. Run once after setting up
// supabase-schema.sql and the SUPABASE_URL / SUPABASE_SECRET_KEY env
// vars, e.g.:
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/migrate-to-supabase.js

const fs = require("node:fs");
const path = require("node:path");
const pluginsRepo = require("../src/pluginsRepo");

const DATA_DIR = path.join(__dirname, "..", "data");
const PLUGINS_JSON = path.join(DATA_DIR, "plugins.json");
const PLUGINS_DIR = path.join(DATA_DIR, "plugins");
const DOWNLOADS_DIR = path.join(DATA_DIR, "downloads");

async function main() {
	const plugins = JSON.parse(fs.readFileSync(PLUGINS_JSON, "utf8"));

	for (const plugin of plugins) {
		process.stdout.write(`Migrating ${plugin.id}... `);

		const iconPath = path.join(PLUGINS_DIR, plugin.id, "icon.png");
		const zipPath = path.join(DOWNLOADS_DIR, plugin.file);
		const iconBuffer = fs.readFileSync(iconPath);
		const zipBuffer = fs.readFileSync(zipPath);

		const iconBucketPath = `icons/${plugin.id}.png`;
		const fileBucketPath = `downloads/${plugin.id}.zip`;

		await pluginsRepo.uploadAsset(iconBucketPath, iconBuffer, "image/png");
		await pluginsRepo.uploadAsset(fileBucketPath, zipBuffer, "application/zip");

		await pluginsRepo.upsertPlugin({
			id: plugin.id,
			name: plugin.name,
			description: plugin.description || "",
			author: plugin.author || "Nothing IDE",
			author_verified: plugin.author_verified !== false,
			license: plugin.license || "MIT",
			version: plugin.version || "1.0.0",
			keywords: plugin.keywords || [],
			changelogs: plugin.changelogs || "",
			supported_editor: plugin.supported_editor || "cm",
			price: plugin.price || 0,
			currency_symbol: plugin.currencySymbol || "$",
			downloads: plugin.downloads || 0,
			icon_path: iconBucketPath,
			file_path: fileBucketPath,
		});

		console.log("done.");
	}

	console.log(`Migrated ${plugins.length} plugin(s).`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
