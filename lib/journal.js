// Pure logic: builds Xero journals and the Saint Daily file from Triple Whale numbers.
// Format taken from the accountant's corrected file (Advertisement_xero_manual_journals_2026-10-08_to_2026-10-15.csv).
// GST channels: Google, Applovin, Snap, TikTok. Meta and Pinterest have no GST.

export const PLATFORMS = [
  { key: "Meta",      desc: "facebooksAds", expCode: "263", expName: "Social Media Ads - Meta",      accCode: "402", accName: "Accrued Social Media Ads - Meta",      gst: false },
  { key: "Google",    desc: "Google Ads",   expCode: "271", expName: "Social Media Ads - Google",    accCode: "405", accName: "Accrued Social Media Ads - Google",    gst: true  },
  { key: "Pinterest", desc: "Pinterest",    expCode: "318", expName: "Social Media Ads - Pinterest", accCode: "398", accName: "Accrued Social Media Ads - Pinterest", gst: false },
  { key: "Applovin",  desc: "Applovin",     expCode: "314", expName: "Social Media Ads - AppLovin",  accCode: "396", accName: "Accrued Social Media Ads - AppLovin",  gst: true  },
  { key: "Snap",      desc: "Snapchat",     expCode: "299", expName: "Social Media Ads - Snapchat",  accCode: "399", accName: "Accrued Social Media Ads - Snapchat",  gst: true  },
  { key: "TikTok",    desc: "Tiktok",       expCode: "319", expName: "Social Media Ads - TikTok",    accCode: "397", accName: "Accrued Social Media Ads - TikTok",    gst: true  },
];
export const TAX_GST = "GST on Expenses", TAX_NONE = "BAS Excluded";

const plain = (c) => (c / 100).toFixed(2);
const num = (n) => String(n);                       // plain number text, like 5345.4 or 1217.535
export const dot = (iso) => { const [y, m, d] = iso.split("-"); return `${d}.${m}.${y}`; };
export const slash = (iso) => { const [y, m, d] = iso.split("-"); return `${+d}/${+m}/${y}`; };   // 8/10/2026, as in the accountant's file

// tw = { "2026-10-08": { Meta: 5512.83, ... }, ... }  ->  one journal per day that has spend.
// Triple Whale spend is the expense (debit) amount. GST channels are credited at spend x 1.1 (3 decimals),
// and Xero adds the 10% GST (820) line itself from "GST on Expenses". Amounts are kept in thousandths (mills).
export function buildJournals(days, tw) {
  const journals = [], warnings = [];
  days.forEach((day) => {
    const row = tw[day] || {};
    const lines = [];
    PLATFORMS.forEach((p) => {
      const v = row[p.key];
      if (v === undefined || v === null) { warnings.push(`${day}: Triple Whale returned no ${p.key} value, treated as 0.`); return; }
      const c = Math.round(v * 100);
      if (c <= 0) return;
      const debit = c * 10, credit = p.gst ? c * 11 : c * 10;
      lines.push({ desc: p.desc, code: p.expCode, account: `${p.expCode} - ${p.expName}`, tax: p.gst ? TAX_GST : TAX_NONE, mills: debit, gstMills: p.gst ? c : 0 });
      lines.push({ desc: p.desc, code: p.accCode, account: `${p.accCode} - ${p.accName}`, tax: TAX_NONE, mills: -credit, gstMills: 0 });
    });
    if (!lines.length) return;
    const dr = lines.filter((l) => l.mills > 0).reduce((s, l) => s + l.mills, 0);
    const gst = lines.reduce((s, l) => s + l.gstMills, 0);
    const cr = -lines.filter((l) => l.mills < 0).reduce((s, l) => s + l.mills, 0);
    journals.push({ day, narration: "Advertisement as per Triple Whale for " + dot(day), lines, dr, gst, cr, balanced: dr + gst === cr });
  });
  return { journals, warnings };
}

const csvEsc = (v) => { const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvJoin = (rows) => rows.map((r) => r.map(csvEsc).join(",")).join("\r\n") + "\r\n";

export function xeroCsv(journals) {
  const rows = [["*Narration", "*Date", "Description", "*AccountCode", "TaxRate", "*Amount", "TrackingName1", "TrackingOption1", "TrackingName2", "TrackingOption2"]];
  journals.forEach((j) => j.lines.forEach((l) => rows.push([j.narration, slash(j.day), l.desc, l.code, l.tax, num(l.mills / 1000), "", "", "", ""])));
  return csvJoin(rows);
}

export function journalRows(journals) {
  const out = [];
  journals.forEach((j) => j.lines.forEach((l) => out.push({ Narration: j.narration, Date: slash(j.day), Description: l.desc, Account: l.account, "Tax Rate": l.tax, Amount: l.mills / 1000 })));
  return out;
}

export function dailyCsv(days, tw) {
  const rows = [["Date"].concat(PLATFORMS.map((p) => p.key))];
  days.forEach((d) => rows.push([d].concat(PLATFORMS.map((p) => plain(Math.round(((tw[d] || {})[p.key] || 0) * 100))))));
  return csvJoin(rows);
}
