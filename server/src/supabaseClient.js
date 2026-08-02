const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");

const SUPABASE_URL = process.env.SUPABASE_URL;
// Supabase's newer "secret key" format (sb_secret_...) replaces the legacy
// service_role JWT for server-side, RLS-bypassing access. Falls back to
// SUPABASE_SERVICE_ROLE_KEY for anyone still using the legacy key.
const SUPABASE_SECRET_KEY =
	process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLUGIN_ASSETS_BUCKET = "plugin-assets";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
	console.warn(
		"SUPABASE_URL / SUPABASE_SECRET_KEY are not set - plugin listing, downloads, and uploads will fail until they're configured.",
	);
}

// Server-side only: the secret key bypasses RLS, so it must never be sent to
// the app or a browser - it only ever lives in this process's env.
// createClient() always spins up a Realtime client internally, even though
// this server only ever does plain database/storage calls. On Node < 22
// (no native WebSocket global) that throws unless a WebSocket implementation
// is provided explicitly - the "ws" package here, harmless on newer Node too.
const supabase =
	SUPABASE_URL && SUPABASE_SECRET_KEY
		? createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
				auth: { persistSession: false },
				realtime: { transport: ws },
			})
		: null;

module.exports = { supabase, PLUGIN_ASSETS_BUCKET };
