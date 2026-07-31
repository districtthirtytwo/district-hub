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

> **Already have a helper running? It needs a one-time update.** Cloudflare → your worker → **Edit code** → select everything → paste the whole of `worker.js` from this repo → **Deploy**. That takes about a minute and adds three things: the ability to take documents down, a guard so two admins can't overwrite each other, and a limit on password guessing. Until you do this, everything else keeps working — the hub will just tell you it can't remove files.


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
   - Variable `ALLOWED_ORIGIN` — the exact address of your hub, e.g. `https://districtthirtytwo.github.io` (optional, but it stops other websites calling your helper)
5. Copy the worker's URL (looks like `https://district-hub-publish.yourname.workers.dev`).
6. Open `index.html` in a text editor, find `const PUBLISH_URL = "";` near the top of the script, and paste the URL between the quotes. Re-upload `index.html` to the repo (Add file → Upload files → drag → Commit).

Done. The helper only accepts writes to `content.json` and `files/` — even someone with the password can't alter the page itself — and the free tier's 100,000 requests/day is roughly 99,990 more than you'll use.

---

## Part D — Using the hub week to week

This is everything an admin needs. Nothing here requires any technical knowledge.

**Getting in.** Open the hub, click **🔒 Admin** at the top right, type the password. You only do this once per computer — it remembers you. Then click **Open Editor**.

**The golden rule:** nothing you do is visible to anyone until you click **🚀 Publish to site**. Edit freely; the page in the background updates as you type so you can see exactly what everyone will get.

**Posting a newsletter, report, or resource.** Go to the right tab, drag the file onto the dashed box (or click it to browse). The file is checked before it is accepted — if it is the wrong type or too big you get a plain-English message telling you what to do. Once it lands, the title box opens automatically so you can give it a proper name instead of the filename. Fill that in, then Publish.

> There is deliberately no "+ Add" button on these three tabs. An entry without a file would be a dead link on the live site, so dropping the file *is* how you add one.

**Posting news or an event.** News & Banner or Events tab → **+ Add** → fill in the fields → **Save** → **Publish**. If you click Add by mistake, click **Cancel** and nothing is left behind.

**Updating a competition.** Competitions tab → Edit. Standings go one per line as `Name, score` — the score can be a number or a placing, so both `Maria Delgado, 62` and `Maria Delgado, 1st` work. Untick **Active** to take a competition off the page without deleting it. When a competition's end date passes it automatically switches to showing **Final standings** with an ENDED badge, so you do not have to remember to change anything.

**The scoreboard.** You never touch it. It reads the two district Quote & Sales Google Sheets every time someone opens the page. Change the sheet, the hub follows. The Admin → Scoreboard tab is read-only and just tells you what is currently loaded.

### If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| "You have unpublished changes from…" when you sign in | You edited last time but never published. Your work was saved in this browser. | **OK** keeps it. **Cancel** throws it away. Files you had dropped in need re-adding. |
| A red ⚠ **No file attached** on an entry | That entry will be a dead link on the live site. | Delete it and add it again by dropping the file. |
| "Couldn't load the numbers" on the scoreboard | The hub cannot reach one or both Google Sheets. | Check the sheets are still **published to the web as CSV**. The board shows nothing rather than showing numbers that might be wrong. |
| "District 49 numbers could not be loaded" | One sheet worked, the other didn't. | Combined totals are switched off automatically so you never see a half-complete total. Fix the sheet link. |
| A warning that one district's sheet is behind | The two sheets were last updated on different days. | Use the D32 / D49 buttons rather than Combined until both refresh. |
| ❌ and a message after Publish | The publish did not finish. | The message says whether any files got through. Press Publish again — it is safe to retry. |
| Your browser warns you about leaving the page | You have unpublished work. | Stay and Publish, or leave and pick it up next time. |
| "Someone else published while you were editing" | Another admin published after you started. **Nothing was overwritten** — your publish was refused, not theirs. | Reload the hub, redo your change, publish again. |
| "this hub's publish helper is an older version that cannot remove files" | The worker in Cloudflare predates the update in Part C. | Your content still published. Do the Part C update, then delete the item again. |
| "Too many wrong passwords" | Someone entered the wrong password repeatedly. | Wait about ten minutes. |

**Adding an admin:** send them the hub address and the password. Nothing to install.
**Changing the password:** Cloudflare → your worker → Settings → edit `ADMIN_PASSWORD`. Everyone signs in again with the new one.

## Part E — Rolling it out

Send everyone the URL with one line of instructions:

- **Chrome:** Settings → On startup → "Open a specific page or set of pages" → paste the hub URL.
- **Edge:** Settings → Start, home, and new tabs → "Open these pages."

---

## Straight talk — things to decide with eyes open

1. **The site is public.** Free GitHub Pages means anyone with the URL can *view* it — including production numbers and names. It's unlisted, but not locked. If the district wants viewing restricted too, the upgrade paths are a private repo on GitHub Pro (~$4/mo) or a free Cloudflare Access gate in front. Make this call before wide rollout.
2. **The scoreboard depends on the sheets staying published.** It reads both districts' *Publish to web → CSV* links. If someone un-publishes a sheet or changes its structure, the board shows the last saved copy and a red status instead of silently going wrong — but it will be stale until the link is fixed.
3. **One publisher at a time.** Edits stage in each admin's browser until published; if two people edit simultaneously, the last publish wins. With two admins, a simple "I'm updating the hub" text avoids it entirely.
4. **Taking a document down.** Deleting a report, newsletter or resource now asks whether to remove the file itself as well. Say yes and the file is deleted from the site — anyone with the old link gets "not found". The page is always updated *before* the file is removed, so nobody can land on a link to a file that has already gone.

   One limit worth understanding: the file is removed from the live site, but it remains in the repository's history, which is public. Anyone who knew to go looking through past versions could still retrieve it. That is fine for "we posted the wrong version, pull it" — the everyday case. It is **not** a remedy for genuinely confidential material accidentally published. If that ever happens, treat it as a disclosure: tell the district office immediately, don't rely on deletion alone.
5. **If the helper is ever down** (or you haven't set it up yet), the editor still works — use **⬇ Export content.json** and upload the file to the repo by hand (Add file → Upload files). Same result, just manual.
