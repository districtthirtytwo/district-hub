/* =====================================================================
   District Hub — publish helper (Cloudflare Worker)

   This tiny service is what lets ANYONE with the admin password publish
   hub updates, with zero setup on their computer. It holds the GitHub
   token and the admin password as server-side secrets, checks the
   password on every request, and only ever writes content.json and
   files/* — it can never touch index.html or anything else.

   One-time deploy (see SETUP.md Part C):
     1. Cloudflare dashboard → Workers & Pages → Create → Worker → Deploy
     2. Edit code → paste this whole file → Deploy
     3. Settings → Variables & Secrets:
          Secrets:   ADMIN_PASSWORD   (the password your admins will use)
                     GH_TOKEN         (fine-grained token, Contents: read/write)
          Variables: REPO_OWNER       (your GitHub username)
                     REPO_NAME        (e.g. district-hub)
                     BRANCH           (main)
     4. Copy the worker URL into PUBLISH_URL near the top of index.html.
   ===================================================================== */

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    const json = (obj, status) =>
      new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json', ...cors },
      });

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Bad request body' }, 400);
    }

    // --- password check (constant-time-ish compare) ---
    const given = String(body.password || '');
    const want = String(env.ADMIN_PASSWORD || '');
    let mismatch = given.length === want.length ? 0 : 1;
    for (let i = 0; i < Math.max(given.length, want.length); i++) {
      mismatch |= (given.charCodeAt(i % Math.max(given.length, 1)) || 0) ^
                  (want.charCodeAt(i % Math.max(want.length, 1)) || 0);
      if (given.length !== want.length) mismatch |= 1;
    }
    if (!want || mismatch !== 0) return json({ ok: false, error: 'Wrong password' }, 401);

    if (body.action === 'verify') return json({ ok: true }, 200);

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

    const published = [];
    for (const f of body.files) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${f.path}`;
      let sha;
      const get = await fetch(`${url}?ref=${branch}`, { headers });
      if (get.ok) sha = (await get.json()).sha;
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
