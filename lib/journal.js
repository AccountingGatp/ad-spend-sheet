// Pure logic: builds Xero journals and the Saint Daily file from Triple Whale numbers.
// Matches posted journal #32268: expense Dr (ex-GST), Accrued Cr (full amount), Xero adds the GST (820) line itself
// from the tax rate. Only Google, Snap and TikTok carry GST. Meta, Pinterest and Applovin do not.

export const PLATFORMS = [
  { key: "Meta",      desc: "facebooksAds", expCode: "263", expName: "Social Media Ads - Meta",      accCode: "402", accName: "Accrued Social Media Ads - Meta",      gst: false },
  { key: "Google",    desc: "Google Ads",   expCode: "271", expName: "Social Media Ads - Google",    accCode: "405", accName: "Accrued Social Media Ads - Google",    gst: true  },
  { key: "Pinterest", desc: "Pinterest",    expCode: "318", expName: "Social Media Ads - Pinterest", accCode: "398", accName: "Accrued Social Media Ads - Pinterest", gst: false },
  { key: "Applovin",  desc: "Applovin",     expCode: "314", expName: "Social Media Ads - AppLovin",  accCode: "396", accName: "Accrued Social Media Ads - AppLovin",  gst: false },
  { key: "Snap",      desc: "Snapchat",     expCode: "299", expName: "Social Media Ads - Snapchat",  accCode: "399", accName: "Accrued Social Media Ads - Snapchat",  gst: true  },
  { key: "TikTok",    desc: "Tiktok",       expCode: "319", expName: "Social Media Ads - TikTok",    accCode: "397", accName: "Accrued Social Media Ads - TikTok",    gst: true  },
];
export const TAX_GST = "GST on Expenses", TAX_NONE = "BAS Excluded";

const p2 = (n) => String(n).padStart(2, "0");
const parts = (iso) => iso.split("-");
export const dot = (iso) => { const [y, m, d] = parts(iso); return `${d}.${m}.${y}`; };
export const slash = (iso) => { const [y, m, d] = parts(iso); return `${d}/${m}/${y}`; };
const plain = (c) => (c / 100).toFixed(2);

// tw = { "2026-10-07": { Meta: 5433.16, ... }, ... }  ->  one journal per day that has spend
export function buildJournals(days, tw) {
  const journals = [], warnings = [];
  days.forEach((day) => {
    const row = tw[day] || {};
    const lines = [];
    PLATFORMS.forEach((p) => {
      const v = row[p.key];
      if (v === undefined || v === null) { warnings.push(`${day}: Triple Whale returned no ${p.key} value, treated as 0.`); return; }
      const ac = Math.round(v * 100);
      if (ac <= 0) return;
      let d = ac;
      if (p.gst) {
        const d0 = Math.round(ac / 1.1);
        d = [d0, d0 - 1, d0 + 1].find((x) => x + Math.round(x / 10) === ac);
        if (d === undefined) d = d0;
      }
      lines.push({ desc: p.desc, code: p.expCode, account: `${p.expCode} - ${p.expName}`, tax: p.gst ? TAX_GST : TAX_NONE, cents: d, gst: ac - d });
      lines.push({ desc: p.desc, code: p.accCode, account: `${p.accCode} - ${p.accName}`, tax: TAX_NONE, cents: -ac, gst: 0 });
    });
    if (!lines.length) return;
    const dr = lines.filter((l) => l.cents > 0).reduce((s, l) => s + l.cents, 0);
    const gst = lines.reduce((s, l) => s + l.gst, 0);
    const cr = -lines.filter((l) => l.cents < 0).reduce((s, l) => s + l.cents, 0);
    journals.push({ day, narration: "Advertisement as per Triple Whale for " + dot(day), lines, dr, gst, cr, balanced: dr + gst === cr });
  });
  return { journals, warnings };
}

const csvEsc = (v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvJoin = (rows) => rows.map((r) => r.map(csvEsc).join(",")).join("\r\n") + "\r\n";

export function xeroCsv(journals) {
  const rows = [["*Narration", "*Date", "Description", "*AccountCode", "TaxRate", "*Amount", "TrackingName1", "TrackingOption1", "TrackingName2", "TrackingOption2"]];
  journals.forEach((j) => j.lines.forEach((l) => rows.push([j.narration, slash(j.day), l.desc, l.code, l.tax, plain(l.cents), "", "", "", ""])));
  return csvJoin(rows);
}

export function journalRows(journals) {
  const out = [];
  journals.forEach((j) => j.lines.forEach((l) => out.push({ Narration: j.narration, Date: slash(j.day), Description: l.desc, Account: l.account, "Tax Rate": l.tax, Amount: l.cents / 100 })));
  return out;
}

export function dailyCsv(days, tw) {
  const rows = [["Date"].concat(PLATFORMS.map((p) => p.key))];
  days.forEach((d) => rows.push([d].concat(PLATFORMS.map((p) => plain(Math.round(((tw[d] || {})[p.key] || 0) * 100))))));
  return csvJoin(rows);
}
