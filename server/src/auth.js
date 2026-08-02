const { supabase } = require("./supabaseClient");

function bearerToken(req) {
	const header = req.headers.authorization || "";
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : null;
}

/**
 * Resolves the Supabase Auth user for a request's `Authorization: Bearer`
 * header, or null if there isn't one / it's invalid. Never throws - callers
 * that only need "logged in or not" (e.g. the owned=true plugin filter)
 * should use this instead of the throwing requireUser middleware.
 * @returns {Promise<{id: string, email: string|null} | null>}
 */
async function getUserFromRequest(req) {
	if (!supabase) return null;
	const token = bearerToken(req);
	if (!token) return null;

	const { data, error } = await supabase.auth.getUser(token);
	if (error || !data?.user) return null;
	return { id: data.user.id, email: data.user.email || null };
}

/** Express middleware: 401s if there's no valid signed-in user, otherwise
 * attaches it as req.user. Use on routes that require an account
 * (checkout) rather than ones that just personalize a public response. */
function requireUser(req, res, next) {
	getUserFromRequest(req).then((user) => {
		if (!user) {
			return res.status(401).json({ error: "Sign in required." });
		}
		req.user = user;
		next();
	}, next);
}

module.exports = { getUserFromRequest, requireUser };
