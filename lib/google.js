// Google Sheets over plain REST. Signs in with the refresh token stored in Vercel settings.
let cached = null;

export async function accessToken() {
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error("Google is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel.");
  if (!GOOGLE_REFRESH_TOKEN) throw new Error("Google is not connected yet. Open /api/google/connect once and follow the steps.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: GOOGLE_REFRESH_TOKEN, grant_type: "refresh_token" }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error("Google sign-in failed (" + (j.error_description || j.error) + "). Open /api/google/connect to connect again.");
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.token;
}

async function api(path, init = {}) {
  const token = await accessToken();
  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + path, {
    ...init,
    headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(init.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) return j;
  if (res.status === 404) throw new Error("Could not find that sheet. Check the link is a Google Sheets link.");
  if (res.status === 403) throw new Error("Your Google account cannot open that sheet. Open it with the account you connected, or ask the owner for access.");
  throw new Error("Google Sheets error " + res.status + ": " + (j.error?.message || "unknown"));
}

export async function getMeta(id) {
  return api(`${id}?fields=properties.title,sheets.properties(sheetId,title)`);
}

export async function pickTab(id, gid) {
  const meta = await getMeta(id);
  const tabs = meta.sheets.map((s) => s.properties);
  const tab = (gid && tabs.find((t) => String(t.sheetId) === String(gid))) || tabs[0];
  return { fileTitle: meta.properties.title, tab: tab.title };
}

const q = (s) => encodeURIComponent(s);

// Rows are returned with trailing empty cells trimmed; missing cells are undefined.
export async function readGrid(id, tab, render) {
  const range = q(`'${tab.replace(/'/g, "''")}'!A1:AZ120`);
  const j = await api(`${id}/values/${range}?valueRenderOption=${render}&dateTimeRenderOption=SERIAL_NUMBER`);
  return j.values || [];
}

export async function readCells(id, ranges, render) {
  const qs = ranges.map((r) => "ranges=" + q(r)).join("&");
  const j = await api(`${id}/values:batchGet?${qs}&valueRenderOption=${render}&dateTimeRenderOption=SERIAL_NUMBER`);
  return (j.valueRanges || []).map((v) => v.values?.[0]?.[0]);
}

export async function writeCells(id, data) {
  return api(`${id}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data: data.map((d) => ({ range: d.range, values: [[d.value]] })) }),
  });
}
