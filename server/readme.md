# Nothing IDE Plugin Server

A self-hosted replacement for Acode's plugin marketplace backend — no dependency on
acode.app. Plugin metadata lives in a **Supabase** Postgres table, and icons/zip
archives live in **Supabase Storage**. That means adding a new plugin or theme is
a web upload, not a git commit + redeploy. Accounts (Supabase Auth, GitHub/Google
sign-in) and paid plugins (Google Play Billing) are supported - see
"Accounts and paid plugins" below.

The `data/` folder in this repo (`plugins.json`, `plugins/`, `downloads/`) is the
original flat-file seed content, kept only as the source for the one-time
migration script (see below) and as a local example to copy from — the running
server no longer reads it at request time.

## One-time setup: Supabase

1. Create a free project at [supabase.com](https://supabase.com) (no credit card
   required).
2. Open **SQL Editor → New query**, paste the contents of `supabase-schema.sql`
   in this folder, and run it. This creates the `plugins` table and an atomic
   download-counter function.
3. Open **Storage → New bucket**, name it exactly `plugin-assets`, and check
   **Public bucket**. That's the only bucket needed — icons and zips both live
   in it, under `icons/` and `downloads/` subfolders created automatically on
   first upload.
4. Open **Settings → API Keys** and copy the **Project URL** and the
   **Secret key** (`sb_secret_...`) — not the **Publishable key**
   (`sb_publishable_...`). The secret key is required for the server to write
   plugin rows and upload files, and must never be shipped to the app or a
   browser. (Older Supabase projects instead show a legacy `service_role` JWT
   under **Project API keys** — that works too, as `SUPABASE_SERVICE_ROLE_KEY`.)

## Run locally

```bash
cd server
npm install
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SECRET_KEY=your-secret-key \
UPLOAD_ADMIN_TOKEN=some-long-random-string \
npm start
```

Server listens on `http://localhost:3000` (or `$PORT` if set). `UPLOAD_ADMIN_TOKEN`
is a password you make up yourself — it gates the `/upload` page and its API so
random visitors can't publish plugins.

### Migrate the two example plugins

Once the schema and bucket exist, seed Supabase with `hello-world` and
`uuid-generator` from this repo's `data/` folder:

```bash
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SECRET_KEY=your-secret-key \
node scripts/migrate-to-supabase.js
```

## Deploy to Vercel (free tier)

The Express app runs as a single serverless function via `api/index.js` + `vercel.json`
(both already set up in this folder) — no other code changes needed.

1. Push this repository to GitHub (already done if you're using `guru071/Nothing-IDE`).
2. On [vercel.com](https://vercel.com), **Add New → Project**, import the repo.
3. Set **Root Directory** to `server`.
4. Framework preset: **Other**. Build command / output directory: leave default/empty.
5. In **Settings → Environment Variables**, add `SUPABASE_URL`,
   `SUPABASE_SECRET_KEY`, and `UPLOAD_ADMIN_TOKEN`.
6. Deploy. Vercel gives you a URL like `https://your-project.vercel.app`.

**Free-tier caveats to know about:**
- Response size is capped (~4.5MB) on Vercel's Hobby plan for the `/api/plugin/download/:id`
  route — but that route now just 302-redirects to the file's Supabase Storage URL, so it's
  no longer a concern (Supabase serves the actual bytes, not this server).
- Supabase's free tier pauses a project after a week of no API requests; one visit to the
  marketplace (or the `/upload` page) wakes it back up within a few seconds.

## Point the app at this server

In Nothing IDE: **Settings → Plugin server**, enter your deployed URL (e.g.
`https://your-project.vercel.app`). No rebuild needed — it's a runtime setting.
This is already the app's *default* plugin server, so most users won't need to
touch this setting at all.

## Publishing a plugin or theme

Visit `https://your-project.vercel.app/upload` in any browser. Fill in the form
(plugin ID, name, version, an icon PNG, and the plugin's zip file), enter your
`UPLOAD_ADMIN_TOKEN`, and submit — it's live in the app's Extensions panel
immediately, no redeploy.

The zip must be flat (no wrapper folder) and contain `plugin.json`, `main.js`,
`icon.png`, and `readme.md` — see `data/plugins/hello-world/` for a working
example, including the `acode.setPluginInit`/`acode.addCommand` API pattern.
**Themes are published exactly the same way** — a "theme plugin" is just a
normal plugin whose `main.js` calls the theme-registration API instead of
`addCommand` (see `src/lib/acode.js`'s theme registry object in the app for the
exact `register`/`unregister`/`apply` methods available to plugins).

Publishing again with the same plugin ID replaces it in place (same as bumping
its version) — there's no separate "update" flow. To publish a **paid** plugin,
also fill in **Price** and **Google Play SKU** — the SKU must already exist as a
one-time product for this app in the Google Play Console (Play Billing requires
products to be created there; this server can't create them for you).

## Accounts and paid plugins

Two pieces, both opt-in (the server runs fine without either configured - free
plugins and anonymous browsing keep working exactly as before):

**Accounts** use Supabase's own built-in Auth, not custom code here:
1. In the Supabase dashboard: **Authentication → Providers**, enable **GitHub**
   and/or **Google**.
2. Each needs an OAuth app/client created on that provider's own developer
   console (GitHub: Settings → Developer settings → OAuth Apps. Google: Cloud
   Console → Credentials → OAuth client ID), with the callback URL Supabase's
   dashboard shows you (`https://<project-ref>.supabase.co/auth/v1/callback`).
   Paste the resulting Client ID/Secret into Supabase's provider settings.
3. That's it on the server side - `getUserFromRequest`/`requireUser` in
   `src/auth.js` verify whatever Supabase Auth session token the app sends,
   there's nothing else to configure here.

**Paid plugins** are verified through Google Play Billing (the app already has
`cordova-plugin-iap` wired up for this), not a separate payment processor -
Play Store policy requires in-app digital goods to go through Play Billing.
Server-side purchase verification needs a Google Cloud service account with
Play Console access:
1. Google Cloud Console → create/select a project → **APIs & Services →
   Library** → enable "Google Play Android Developer API".
2. **IAM & Admin → Service Accounts** → create one → **Keys** → add key → JSON
   (downloads a file with `client_email` and `private_key`).
3. Play Console → **Users and permissions** → invite that service account's
   email with "View financial data" + app access permissions.
4. Set either `GOOGLE_SERVICE_ACCOUNT_JSON` (the whole downloaded file's
   contents, as one env var) or both `GOOGLE_SERVICE_ACCOUNT_EMAIL` +
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` on the server.
5. Run the `purchases` table section of `supabase-schema.sql` (added
   alongside `plugins`) if you haven't already.

**Not on Play Store yet?** The app falls back to a native Razorpay checkout
instead (`helpers.shouldAllowExternalPurchase()` in the app detects this
automatically - no Play Console account needed to sell plugins in the
meantime):
1. Razorpay dashboard → **Settings → API Keys** → generate a Key ID + Key
   Secret (test mode keys work for trying this out before going live).
2. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the server. The Key ID
   is also handed to the app per-order (safe, it's meant to be public); the
   Key Secret never leaves the server - it's only used here to create orders
   and verify payment signatures.
3. Run the `purchases` (with its `razorpay_order_id`/`razorpay_payment_id`
   columns) and `razorpay_orders` table sections of `supabase-schema.sql`.
4. Prices for this path are read straight off the plugin's `price` field as
   rupees (Razorpay is INR-first) - set it accordingly when uploading a
   plugin meant to sell through this path.
5. Branding shown in the checkout sheet (name/logo/theme color) comes from
   the app's own `src/lib/config.js` (`BRAND_NAME`/`BRAND_LOGO_URL`/
   `BRAND_COLOR`) and `server/public/brand-icon.png` - replace that file to
   change the logo.

## API reference

| Endpoint | Purpose |
|---|---|
| `GET /api/plugins?page=&limit=&name=&explore=random&orderBy=&owned=true` | List/search/paginate plugins (`owned=true` needs an `Authorization: Bearer <supabase-session-token>` header, returns only that user's purchased plugins) |
| `GET /api/plugin/:id` | Single plugin's full metadata |
| `GET /api/plugin/download/:id` | Redirects to the plugin's zip in Supabase Storage |
| `GET /api/plugin/check-update/:id/:version` | Check if a newer version exists |
| `POST /api/plugin/order` | Verifies a Google Play purchase token (requires auth) and records ownership |
| `POST /api/plugin/razorpay/order` | Creates a Razorpay order for a paid plugin (requires auth) |
| `POST /api/plugin/razorpay/verify` | Verifies a completed Razorpay payment's signature and records ownership (requires auth) |
| `GET /upload` | Browser upload form |
| `POST /api/admin/plugins` | Publish/replace a plugin (requires `x-admin-token` header) |
