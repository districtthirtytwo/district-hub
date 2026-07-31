/* =====================================================================
   District Hub — publish helper (Cloudflare Worker)

   This tiny service is what lets ANYONE with the admin password publish
   hub updates, with zero setup on their computer. It holds the GitHub
   token and the admin password as server-side secrets, checks the
   password on every request, and only ever touches content.json and
   files/* — it can never alter index.html or anything else.

   WHAT IT DOES
     verify   — check a password (used when signing in)
     publish  — write content.json and any new files
     delete   — remove files from the site (files/* only)

   VERSION 2 — if you are updating an existing worker, paste this whole
   file over the old one and Deploy. Everything the hub already does
   keeps working; this adds three things:
     1. Taking documents down. The old worker could only ever add, so
        removing a report from the list left the file live at its web
        address forever.
     2. A guard against two admins overwriting each other. Each publish
        carries the revision it started from; if someone else published
        in the meantime the second publish is refused instead of
        silently wiping the first.
     3. Slowing down password guessing. The old worker would accept
        unlimited attempts as fast as they could be sent.

   One-time deploy (see SETUP.md Part C):
     1. Cloudflare dashboard → Workers & Pages → Create → Worker → Deploy
     2. Edit code → paste this whole file → Deploy
     3. Settings → Variables & Secrets:
          Secrets:   ADMIN_PASSWORD   (the password your admins will use)
                     GH_TOKEN         (fine-grained token, Contents: read/write)
          Variables: REPO_OWNER       (your GitHub username)
                     REPO_NAME        (e.g. district-hub)
                     BRANCH           (main)
                     ALLOWED_ORIGIN   (optional but recommended — the exact
                                       address of your hub, e.g.
                                       https://districtthirtytwo.github.io)
     4. Copy the worker URL into PUBLISH_URL near the top of index.html.
   ===================================================================== */

/* Failed-password tracking. Cloudflare gives a plain Worker no durable
   storage, so this lives in memory and resets whenever the isolate is
   recycled — it is a speed bump, not a lock. The real protection is the
   deliberate delay on every failed attempt, which caps how fast anyone
   can guess no matter how many isolates they hit. Use a long passphrase
   rather than a short password. */
const attempts = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 12;
const FAIL_DELAY_MS = 1200;

function noteFailure(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { n: 0, first: now };
  if (now - rec.first > WINDOW_MS) { rec.n = 0; rec.first = now; }
  rec.n++;
  attempts.set(ip, rec);
  if (attempts.size > 5000) attempts.clear();   // never let this grow unbounded
  return rec.n;
}
function isLockedOut(ip) {
  const rec = attempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) { attempts.delete(ip); return false; }
  return rec.n >= MAX_FAILS;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* Timing-safe comparison of two strings. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (obj, status) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (isLockedOut(ip)) {
      await sleep(FAIL_DELAY_MS);
      return json({ ok: false, error: 'Too many wrong passwords. Wait about ten minutes and try again.' }, 429);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Bad request body' }, 400);
    }

    // --- password check ---
    const want = String(env.ADMIN_PASSWORD || '');
    if (!want || !sameSecret(String(body.password || ''), want)) {
      const n = noteFailure(ip);
      await sleep(FAIL_DELAY_MS);   // caps guessing speed regardless of isolate churn
      return json({ ok: false, error: 'Wrong password', attempt: n }, 401);
    }
    attempts.delete(ip);

    if (body.action === 'verify') return json({ ok: true, workerVersion: 2 }, 200);

    const owner = env.REPO_OWNER, repo = env.REPO_NAME, branch = env.BRANCH || 'main';
    if (!owner || !repo || !env.GH_TOKEN)
      return json({ ok: false, error: 'Helper is missing its settings (REPO_OWNER / REPO_NAME / GH_TOKEN)' }, 500);

    const headers = {
      Authorization: 'Bearer ' + env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'district-hub-publish-helper',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    };
    const apiUrl = path => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const getFile = async path => {
      const r = await fetch(`${apiUrl(path)}?ref=${branch}`, { headers });
      if (!r.ok) return null;
      return r.json();
    };

    /* ---------------- delete ----------------
       Only files/* may be removed. content.json and index.html are not
       deletable at all, so a leaked password can never blank the site. */
    if (body.action === 'delete') {
      if (!Array.isArray(body.paths) || !body.paths.length)
        return json({ ok: false, error: 'Nothing to delete' }, 400);
      for (const p of body.paths) {
        const path = String(p || '');
        const safe = /^[a-zA-Z0-9._/-]+$/.test(path) && !path.includes('..') &&
                     path.startsWith('files/') && path.length > 6;
        if (!safe) return json({ ok: false, error: 'Path not allowed: ' + path }, 400);
      }
      const deleted = [], skipped = [];
      for (const p of body.paths) {
        const path = String(p);
        const meta = await getFile(path);
        if (!meta || !meta.sha) { skipped.push(path); continue; }   // already gone
        const r = await fetch(apiUrl(path), {
          method: 'DELETE',
          headers,
          body: JSON.stringify({
            message: String(body.message || 'Hub: remove file').slice(0, 200),
            branch,
            sha: meta.sha,
          }),
        });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          return json({ ok: false, error: path + ': ' + (e.message || 'HTTP ' + r.status), deleted }, 502);
        }
        deleted.push(path);
      }
      return json({ ok: true, deleted, skipped }, 200);
    }

    /* ---------------- publish ---------------- */
    if (body.action !== 'publish' || !Array.isArray(body.files) || !body.files.length)
      return json({ ok: false, error: 'Bad request' }, 400);

    // --- only content.json and files/* may ever be written ---
    for (const f of body.files) {
      const p = String(f.path || '');
      const safe =
        /^[a-zA-Z0-9._/-]+$/.test(p) &&
        !p.includes('..') &&
        (p === 'content.json' || (p.startsWith('files/') && p.length > 6));
      if (!safe) return json({ ok: false, error: 'Path not allowed: ' + p }, 400);
      if (!f.base64) return json({ ok: false, error: 'Missing content for ' + p }, 400);
    }

    /* --- refuse to silently overwrite someone else's publish ---
       The browser sends the revision of content.json it started from. If
       what is live now carries a different revision, another admin
       published in the meantime and this publish would erase their work. */
    const currentMeta = await getFile('content.json');
    if (body.baseRev && currentMeta && currentMeta.content) {
      let liveRev = null;
      try {
        const decoded = decodeURIComponent(escape(atob(currentMeta.content.replace(/\n/g, ''))));
        liveRev = (JSON.parse(decoded) || {}).rev || null;
      } catch { liveRev = null; }
      if (liveRev && liveRev !== body.baseRev) {
        return json({
          ok: false,
          conflict: true,
          error: 'Someone else published while you were editing. Reload the hub to pick up their changes, then redo yours — otherwise their work would be erased.',
        }, 409);
      }
    }

    const published = [];
    for (const f of body.files) {
      const url = apiUrl(f.path);
      let sha;
      if (f.path === 'content.json') sha = currentMeta && currentMeta.sha;
      else {
        const meta = await getFile(f.path);
        sha = meta && meta.sha;
      }
      const put = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: String(body.message || 'Hub update via admin panel').slice(0, 200),
          branch,
          content: f.base64,
          ...(sha ? { sha } : {}),
        }),
      });
      if (!put.ok) {
        const e = await put.json().catch(() => ({}));
        return json({ ok: false, error: f.path + ': ' + (e.message || 'HTTP ' + put.status), published }, 502);
      }
      published.push(f.path);
    }
    return json({ ok: true, published }, 200);
  },
};
