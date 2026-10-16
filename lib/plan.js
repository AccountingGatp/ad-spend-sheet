// Pure logic: no network, no Next.js. Tested with plain node.

// One entry per ad channel. `row` matches the label in column A of the Google Sheet,
// `tw` is the Triple Whale metric id that carries that channel's daily spend.
export const CHANNELS = [
  { key: "Meta",      tw: "facebookAds",   row: /meta|facebook/i },
  { key: "Google",    tw: "googleAds",     row: /google/i },
  { key: "Pinterest", tw: "pinterestAds",  row: /pinterest/i },
  { key: "Applovin",  tw: "applovinSpend", row: /applovin/i },
  { key: "Snap",      tw: "snapchatAds",   row: /snap/i },
  { key: "TikTok",    tw: "tiktokAds",     row: /tik\s*tok/i },
];

const MONTHS = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];

export const r2 = (n) => Math.round(n * 100) / 100;

export function parseSheetLink(link) {
  const s = String(link || "").trim();
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(s);
  if (!m) return null;
  const g = /[#&?]gid=(\d+)/.exec(s);
  return { id: m[1], gid: g ? g[1] : null };
}

export function colToA1(i) {            // 0 -> A, 25 -> Z, 26 -> AA
  let s = "", n = i + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export const serialToISO = (n) => new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10);

export function eachDay(fromISO, toISO) {
  const out = [];
  let t = Date.parse(fromISO + "T00:00:00Z");
  const end = Date.parse(toISO + "T00:00:00Z");
  while (t <= end) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000; }
  return out;
}

export function monthLabel(iso) {
  const [y, m] = iso.split("-");
  return MONTHS[+m - 1] + " " + y;
}

const isEmpty = (v) => v === undefined || v === null || v === "";

// grid = rows from Sheets API (UNFORMATTED_VALUE, dates as serial numbers)
export function detectLayout(grid) {
  const dateRow = grid.findIndex((r) => String((r && r[0]) ?? "").trim().toLowerCase() === "date");
  if (dateRow < 0) return { error: 'Could not find a row labelled "Date" in column A.' };

  const dateCols = {};                  // iso -> column index
  (grid[dateRow] || []).forEach((v, c) => {
    if (c > 0 && typeof v === "number" && v > 30000) dateCols[serialToISO(v)] = c;
  });
  const isos = Object.keys(dateCols).sort();
  if (!isos.length) return { error: 'The "Date" row has no dates.' };

  const rows = {};                      // channel key -> row index
  grid.forEach((r, i) => {
    const label = String((r && r[0]) ?? "");
    if (!/spend/i.test(label)) return;
    CHANNELS.forEach((ch) => { if (rows[ch.key] === undefined && ch.row.test(label)) rows[ch.key] = i; });
  });

  return { dateRow, dateCols, rows, first: isos[0], last: isos[isos.length - 1], month: monthLabel(isos[0]), count: isos.length };
}

// tw: { iso: { Meta: number|undefined, ... } }   (undefined = Triple Whale did not return it)
// values / formulas: grids as returned by the Sheets API.
export function buildPlan({ layout, values, formulas, tw, tab }) {
  const items = [];
  Object.keys(tw).sort().forEach((iso) => {
    CHANNELS.forEach((ch) => {
      const twv = tw[iso][ch.key];
      const base = { iso, channel: ch.key, tw: twv === undefined ? null : r2(twv), current: null, a1: null };
      const col = layout.dateCols[iso], row = layout.rows[ch.key];
      if (col === undefined) return items.push({ ...base, status: "nodate" });
      if (row === undefined) return items.push({ ...base, status: "norow" });
      base.a1 = `'${tab.replace(/'/g, "''")}'!${colToA1(col)}${row + 1}`;
      if (twv === undefined) return items.push({ ...base, status: "missing" });

      const f = formulas?.[row]?.[col];
      if (typeof f === "string" && f.startsWith("=")) return items.push({ ...base, status: "formula" });
      const cur = values?.[row]?.[col];
      if (isEmpty(cur)) return items.push({ ...base, status: "fill" });
      const n = Number(cur);
      base.current = Number.isFinite(n) ? r2(n) : cur;
      if (Number.isFinite(n) && Math.abs(n - r2(twv)) < 0.005) return items.push({ ...base, status: "same" });
      return items.push({ ...base, status: "differs" });
    });
  });
  return items;
}
