# BrawlStats V2 ⭐

An English, mobile-friendly fan-made Brawl Stars stats dashboard. Four screens: Overview, Brawlers, Battles, and Insights.

## Requirements
- Node.js 20 or newer
- A free Supercell developer API key from https://developer.brawlstars.com/
- Your current **public IPv4 address** registered on that key

## Installation
1. Extract this ZIP to a new folder.
2. Copy the `.env` file from your **existing BrawlStats project** to this folder. Alternatively copy `.env.example` to `.env` and paste your own key.
3. In VS Code, open this folder and run:

   ```powershell
   npm install
   npm start
   ```

4. Open http://localhost:3000 and enter your player tag **with or without the `#`**.

If you already have a server on port 3000, stop it using Ctrl+C first.

**Never share or commit `.env`.**

## Pages
- **Overview** — current trophies, highest trophies, owned Brawlers, total wins (sum of 3v3, solo and duo win counters), top Brawler and favorite *tracked* mode.
- **Brawlers** — character art, collection, filters, and per-Brawler details.
- **Battles** — saved battle log, filters and CSV export. Click a match for details.
- **Insights** — only explicit win/loss results contribute to the win-rate. Placement-based modes display rank separately. Favorite mode and Brawler use *tracked* matches. Trophy progression comes from saved profile check-ins.

## Data and images
Live profile and battle log: official Supercell API (`api.brawlstars.com`). The key stays on your local Node.js server. Images and catalog metadata: community BrawlAPI (`api.brawlapi.com` and `cdn.brawlify.com`), which are optional: the site still works without them.

## Important limitations
- Total Wins = 3v3Victories + soloVictories + duoVictories where those counters are provided. This is **not guaranteed to cover every historical special mode**.
- No complete lifetime battle log is available. Saved battle data grows only when the local server is running and the dashboard is refreshed or opened. The dashboard does not continuously poll in the background.
- A trophy graph requires at least two snapshots, usually created 30 minutes apart or after a trophy change.
- Battle logs can be delayed. Some modes lack explicit win/loss or player data. This app does not fabricate them.
- Local JSON is stored per tag in `data/TAG.json`, with up to 1,500 battles and 1,500 snapshots per player. To migrate old stored history, copy compatible data files from the old project, if desired. Old versions may have a different format.

## API troubleshooting
- **403:** Confirm key is valid and your current public IPv4 is allowed in the Supercell developer portal.
- **404:** Check your player tag.
- **Missing API key:** Check `.env` next to `server.js` and restart Node.
- **EADDRINUSE:** Stop the older running server.
- **No portraits:** The optional community image source may be unavailable.

## Security and attribution
This is a local personal fan project, not affiliated with or endorsed by Supercell. Respect Supercell's Fan Content Policy and asset providers' terms if deploying publicly. Keep your API key server-side; never publish the `.env` or `data` folder. The local server binds to `127.0.0.1` by default.

## Longer battle history and colors

The official API returns only about 25 recent matches per request. Every dashboard refresh merges unseen matches into `data/<TAG>.json` (up to 1,500 in this version). The site also refreshes every five minutes while its tab is open and visible; close it or stop the server and collection stops. If you play more than 25 matches between refreshes, the older unseen matches cannot be recovered. The battle list displays 50 at a time with **Show More**, and insights use all locally saved matches. Back up the `data` folder when replacing versions.

Green means an explicit victory in team modes, or a positive trophy change for a Showdown placement; red means an explicit defeat or a negative Showdown trophy change. Neutral Showdown results remain yellow. Placement colors **do not** change tracked win-rate calculations.
