# Nothing IDE Plugin Server

A self-hosted replacement for Acode's plugin marketplace backend. No database, no user accounts — plugin metadata lives in `data/plugins.json` and archives live in `data/downloads/`, both plain files checked into this repo. That sidesteps Render's free-tier Postgres database, which gets deleted after 30 days unless you're on a paid plan.

## Run locally

```bash
cd server
npm install
npm start
```

Server listens on `http://localhost:3000` (or `$PORT` if set).

## Deploy to Vercel (free tier)

The Express app runs as a single serverless function via `api/index.js` + `vercel.json` (both already set up in this folder) — no other code changes needed.

1. Push this repository to GitHub (already done if you're using `guru071/Nothing-IDE`).
2. On [vercel.com](https://vercel.com), **Add New → Project**, import the repo.
3. Set **Root Directory** to `server` (since this is a subfolder of the IDE repo).
4. Framework preset: **Other**. Build command / output directory: leave default/empty.
5. Deploy. Vercel gives you a URL like `https://your-project.vercel.app`.

**Free-tier caveats to know about:**
- No persistent disk — anything written at runtime (like the download counter in `plugins.json`) resets on the next deploy, and may not even be shared between concurrent invocations. Fine for this server since nothing critical depends on it.
- Response size is capped (~4.5MB) on the Hobby plan. The bundled `hello-world.zip` example is tiny, but if you add a plugin with a large archive, its `/api/plugin/download/:id` response could exceed that limit and fail — keep individual plugin zips small.
- No cold-start delay worth mentioning (Vercel's functions start fast), unlike Render's free tier.

## Deploy to Render (free tier) — alternative

1. Push this repository to GitHub (or GitLab/Bitbucket).
2. On [render.com](https://render.com), create a new **Web Service** and connect the repo.
3. Set **Root Directory** to `server` (since this is a subfolder of the IDE repo).
4. Build command: `npm install`
5. Start command: `npm start`
6. Instance type: Free.
7. Deploy. Render gives you a URL like `https://your-service.onrender.com`.

**Free-tier caveats to know about:**
- The service spins down after ~15 minutes of inactivity. The next request (e.g. opening the Plugins panel after the app's been idle) takes 30-60+ seconds to wake back up.
- No persistent disk on the free plan — anything written at runtime (like the download counter in `plugins.json`) resets on every redeploy/restart. Fine for this server since nothing critical depends on it; just don't rely on those counts surviving a restart.

## Point the app at this server

In Nothing IDE: **Settings → Plugin server**, enter your deployed URL (e.g. `https://your-project.vercel.app`). No rebuild needed — it's a runtime setting.

## Adding your own plugins

1. Create `data/plugins/<your-plugin-id>/` with `plugin.json`, `main.js`, `icon.png`, `readme.md` (see `data/plugins/hello-world/` for a working example, including the `acode.setPluginInit`/`acode.addCommand` API pattern).
2. Zip the plugin's files (flat, no wrapper folder) into `data/downloads/<your-plugin-id>.zip`:
   ```bash
   cd data/plugins/<your-plugin-id>
   zip -j -X ../../downloads/<your-plugin-id>.zip plugin.json main.js icon.png readme.md
   ```
3. Add an entry to `data/plugins.json` (copy the `hello-world` entry as a template — the `icon` field should be `/static/plugins/<your-plugin-id>/icon.png`, and `file` should be `<your-plugin-id>.zip`).
4. Commit and push — Render redeploys automatically.

## API reference

| Endpoint | Purpose |
|---|---|
| `GET /api/plugins?page=&limit=&name=&explore=random&orderBy=` | List/search/paginate plugins |
| `GET /api/plugin/:id` | Single plugin's full metadata |
| `GET /api/plugin/download/:id` | Download the plugin's zip archive |
| `GET /api/plugin/check-update/:id/:version` | Check if a newer version exists |
| `POST /api/plugin/order` | No-op (no paid plugins/accounts in this server) |
