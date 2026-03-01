// ── Supabase Sync Layer ─────────────────────────────────────────
// Dual-write: every operation writes to localStorage instantly,
// then syncs to Supabase in the background. On login, Supabase
// wins on conflict (last-write-wins by updated_at timestamp).
//
// To enable: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// in your Vercel environment variables. Until then, everything
// runs on localStorage only — no degradation.

const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL  || "";
const SUPA_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const ENABLED   = !!(SUPA_URL && SUPA_KEY);

// ── Raw fetch helper ───────────────────────────────────────────
async function supa(path, opts = {}) {
  if (!ENABLED) return null;
  const url = `${SUPA_URL}/rest/v1/${path}`;
  const headers = {
    apikey:        SUPA_KEY,
    Authorization: `Bearer ${SUPA_KEY}`,
    "Content-Type":  "application/json",
    Prefer:          opts.prefer || "return=representation",
    ...opts.headers,
  };
  try {
    const r = await fetch(url, { ...opts, headers });
    if (!r.ok) {
      const txt = await r.text().catch(() => r.statusText);
      console.warn("[db] Supabase error", r.status, txt);
      return null;
    }
    const text = await r.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.warn("[db] fetch failed:", e.message);
    return null;
  }
}

// ── Projects ───────────────────────────────────────────────────
export async function loadProjects() {
  if (!ENABLED) return null;
  const rows = await supa("og_projects?select=*&order=updated_at.desc");
  if (!rows) return null;
  return rows.map(r => ({ ...JSON.parse(r.data), _supaId: r.id }));
}

export async function upsertProject(entry) {
  if (!ENABLED) return;
  await supa("og_projects", {
    method:  "POST",
    prefer:  "resolution=merge-duplicates,return=minimal",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id:         entry.id,
      data:       JSON.stringify(entry),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function deleteProject(id) {
  if (!ENABLED) return;
  await supa(`og_projects?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
}

// ── Change Orders ──────────────────────────────────────────────
export async function loadChangeOrders() {
  if (!ENABLED) return null;
  const rows = await supa("og_change_orders?select=*");
  if (!rows) return null;
  // Reconstruct { [projectId]: [...cos] }
  const result = {};
  rows.forEach(r => {
    const co = JSON.parse(r.data);
    if (!result[r.project_id]) result[r.project_id] = [];
    result[r.project_id].push(co);
  });
  return result;
}

export async function upsertCO(projectId, co) {
  if (!ENABLED) return;
  await supa("og_change_orders", {
    method:  "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id:         `${projectId}_${co.coId}`,
      project_id: projectId,
      co_id:      co.coId,
      data:       JSON.stringify(co),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function deleteCO(projectId, coId) {
  if (!ENABLED) return;
  await supa(`og_change_orders?id=eq.${encodeURIComponent(`${projectId}_${coId}`)}`, {
    method: "DELETE", prefer: "return=minimal"
  });
}

// ── Settings (stateConfig, userPerms, templates) ───────────────
export async function loadSetting(key) {
  if (!ENABLED) return null;
  const rows = await supa(`og_settings?key=eq.${encodeURIComponent(key)}&select=value`);
  if (!rows || rows.length === 0) return null;
  try { return JSON.parse(rows[0].value); } catch { return null; }
}

export async function saveSetting(key, value) {
  if (!ENABLED) return;
  await supa("og_settings", {
    method:  "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      key,
      value:      JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }),
  });
}

// ── Connection test ────────────────────────────────────────────
export async function testConnection() {
  if (!ENABLED) return { ok: false, reason: "No credentials configured" };
  const rows = await supa("og_settings?select=key&limit=1");
  if (rows === null) return { ok: false, reason: "Could not reach Supabase — check URL and key" };
  return { ok: true };
}

export const supabaseEnabled = ENABLED;
export const supabaseUrl = SUPA_URL;
