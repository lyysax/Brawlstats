# BrawlStats Public — Vercel-ready v3

A publicly searchable Brawl Stars dashboard (Overview, Brawlers, Battles, Insights). **The interface is in English.** No account needed: visitors enter their public player tag.

## 1 — Create a NEW Supercell API key for the proxy

1. Visit https://developer.brawlstars.com and create a second key.
2. Allowlist **45.79.218.79**, the static RoyaleAPI proxy IP documented at https://docs.royaleapi.com/proxy . Do **not** use your home IP for this key.
3. Put the new API token in `.env` locally and in Vercel's Environment Variables as `BRAWL_API_KEY`. **Never commit `.env`.**

**Privacy / third-party warning:** The Brawl Stars API requires an allowlisted egress IP. This project uses the independent RoyaleAPI proxy (`https://bsproxy.royaleapi.dev`) to reach the official API. The proxy receives the developer token. This is not an official Supercell service and its future availability is not guaranteed. Use a dedicated key and revoke it if you stop trusting the proxy. Vercel's own outbound IPs are dynamic on the free plan.

## 2 — Local test

Requires Node.js 20+.

```sh
npm install
cp .env.example .env  # or copy manually on Windows
# set BRAWL_API_KEY in .env
npm start
```

Open http://localhost:3000 and search a tag, such as `#82UJL90C` (the site will strip `#`).

## 3 — Publish to Vercel

1. Create a **new, public or private GitHub repository** and upload this folder's contents, excluding `.env` and `node_modules`.
2. In https://vercel.com choose **Add New → Project → Import Git Repository**.
3. Choose Framework Preset **Other**, Root Directory repository root, and leave Build Command and Output Directory unset/default. Public static files are in `public/`, functions are in `api/`.
4. In Project → Settings → Environment Variables, add `BRAWL_API_KEY` with the **new proxy-whitelisted** token for Production (and Preview if desired). Redeploy after adding/changing env vars.
5. Test your URL: search for multiple different player tags and inspect `/api/dashboard/82UJL90C` on your deployed domain if necessary.

## Data model and limitations

- Official profile and up to ~25 latest battles are fetched anew when someone enters a tag.
- The app **does not have a persistent shared server-side database**. It saves up to 300 deduplicated matches and 300 trophy checkpoints **per player in each visitor's browser**, using localStorage. Clearing browser storage, changing browser/device or using a private window loses that history. The server cannot collect new matches when nobody is viewing the site.
- Insights only cover stored/retrieved matches, not a player's full career. Favorite Mode is the most played in those records.
- **Win/Loss convention for this project:** Positive trophy change = Victory, negative = Defeat; if no trophy change exists, use the explicit API result. Neutral results are excluded from win rate. This is a simplified classification and does not represent official Showdown wins.
- Official overall total win counters sum 3v3, solo and duo victories; not necessarily all possible modes.
- Uses the community BrawlAPI for artwork; icons can fail gracefully.
- API access is limited by upstream quotas; serverless in-memory caching lasts only during warm instances. A popular public site should add proper distributed rate limiting and persistent caching.
- This is an unofficial fan project and is not endorsed by Supercell.

## Moving from your previous version

Do not upload the old local `.env` to GitHub. The old `data/*.json` directory is not automatically migrated because history is now stored by browser. You can keep the old project as backup.
