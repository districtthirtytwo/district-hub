# District Hub — Setup & Owner's Guide

The hub is a folder of four things:

- **index.html** — the page everyone sees (with the built-in admin editor)
- **content.json** — every word on the page: news, events, competitions, newsletters, reports, scoreboard numbers
- **files/** — the actual PDFs (newsletters, reports)
- **worker.js** — the "publish helper" you'll deploy once (Part C); it's what lets any admin publish with just the password

The page re-reads `content.json` on every load, so a publish reaches everyone on their next visit. No server of your own, no database, nothing to maintain month to month.

**How admin access works after setup:** anyone you give the admin password to opens the hub, clicks **🔒 Admin**, types the password once (it's remembered on that device), edits, and hits **Publish**. That's the entire experience for your coworker. The password is checked by the publish helper on every publish — it's real security, not a hidden button.

---

## Part A — Put the site on GitHub Pages (~10 min, once)

1. Create a free account at **github.com** (skip if you have one).
2. **+ → New repository** → name it `district-hub` → **Public** → Create.
3. On the new repo page, click **uploading an existing file**. Drag in `index.html`, `content.json`, `worker.js`, `xlsx.full.min.js` (the spreadsheet reader that powers Excel drops), and `SETUP.md` → **Commit changes**.
4. **Add file → Upload files** again → drag the **files** folder in (drag the folder itself so the `files/` structure is kept) → Commit.
5. **Settings → Pages** → Branch: **main**, folder **/ (root)** → Save.
6. In a minute or two the hub is live at `https://YOURUSERNAME.github.io/district-hub/` — permanent URL, this is what everyone bookmarks.

## Part B — Create the GitHub token (~3 min, once, only you)

The helper needs one key to write updates to the repo. Your coworker never sees or touches this.

1. GitHub → avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Name `district-hub-helper`, expiration **1 year** (calendar reminder to renew).
3. Repository access: **Only select repositories** → `district-hub`.
4. Permissions → Repository permissions → **Contents: Read and write**. Nothing else.
5. Generate and copy it (starts with `github_pat_`). You'll paste it in Part C, then you can forget it.

## Part C — Deploy the publish helper (~10 min, once)

This is the piece that turns "GitHub setup per admin" into "just a password."

1. Create a free account at **cloudflare.com** (no domain or payment needed).
2. Dashboard → **Workers & Pages → Create → Create Worker**. Name it `district-hub-publish` → **Deploy** (it deploys a hello-world first).
3. Click **Edit code**, delete everything in the editor, paste in the entire contents of **worker.js**, then **Deploy**.
4. Back on the worker's page → **Settings → Variables & Secrets** → add:
   - Secret `ADMIN_PASSWORD` — the password your admins will use (pick something strong-ish; it IS the keys)
   - Secret `GH_TOKEN` — the token from Part B
   - Variable `REPO_OWNER` — your GitHub username
   - Variable `REPO_NAME` — `district-hub`
   - Variable `BRANCH` — `main`
5. Copy the worker's URL (looks like `https://district-hub-publish.yourname.workers.dev`).
6. Open `index.html` in a text editor, find `const PUBLISH_URL = "";` near the top of the script, and paste the URL between the quotes. Re-upload `index.html` to the repo (Add file → Upload files → drag → Commit).

Done. The helper only accepts writes to `content.json` and `files/` — even someone with the password can't alter the page itself — and the free tier's 100,000 requests/day is roughly 99,990 more than you'll use.

---

## Part D — Weekly use (this is all your coworker needs to know)

1. Open the hub → **🔒 Admin** → type the admin password (first time on a device only) → **Open Editor**.
2. Do any of:
   - **News & Banner** — post announcements, change the banner strip
   - **Events** — add calls, workshops, deadlines (past events drop off automatically)
   - **Competitions** — update standings (one line per person: `Name, number`), start/end contests
   - **Newsletters** — drag the new PDF onto the drop zone; it becomes the featured issue
   - **Reports** — drag files onto the drop zone. **Excel/CSV files (matrixes, producer reports, life results, quote trackers) become interactive on-brand tables** — viewers get sheet tabs, a search box, and sorted columns styled like the rest of the hub. PDFs and images post as openable files. After the drop, click Edit to set the title and category.
   - **Scoreboard** — **Import CSV** (replaces the board) or fix numbers in the Quick Edits table; set the "Data as of" date
3. Everything previews live on the page as you work.
4. **🚀 Publish to site** — live for everyone within a minute or two.

**Scoreboard CSV columns** (grab one via "Blank CSV template"):
`Name, Agency, Role, District, Owner, Quotes MTD, NB MTD, Quotes YTD, NB YTD`
Role is `Producer` or `Agency`; Owner = `Y` marks an agency owner's own row (hidden when "Staff only" is on, same as your old tracker).

**Adding an admin:** send them the hub URL and the password. Nothing to install, no accounts to create.
**Removing an admin / changing the password:** Cloudflare → your worker → Settings → edit the `ADMIN_PASSWORD` secret. Old password stops working everywhere immediately; current admins just sign in again with the new one.

---

## Part E — Rolling it out

Send everyone the URL with one line of instructions:

- **Chrome:** Settings → On startup → "Open a specific page or set of pages" → paste the hub URL.
- **Edge:** Settings → Start, home, and new tabs → "Open these pages."

---

## Straight talk — things to decide with eyes open

1. **The site is public.** Free GitHub Pages means anyone with the URL can *view* it — including production numbers and names. It's unlisted, but not locked. If the district wants viewing restricted too, the upgrade paths are a private repo on GitHub Pro (~$4/mo) or a free Cloudflare Access gate in front. Make this call before wide rollout.
2. **The scoreboard is hand-fed now.** Numbers move only when someone imports a CSV or edits the table. If that gets tedious, the old Google Sheet auto-feed can be added back as an optional source without changing anything else.
3. **One publisher at a time.** Edits stage in each admin's browser until published; if two people edit simultaneously, the last publish wins. With two admins, a simple "I'm updating the hub" text avoids it entirely.
4. **If the helper is ever down** (or you haven't set it up yet), the editor still works — use **⬇ Export content.json** and upload the file to the repo by hand (Add file → Upload files). Same result, just manual.
