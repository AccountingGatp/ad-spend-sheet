import { CHANNELS } from "./plan";

const URL_ = "https://api.triplewhale.com/api/v2/summary-page/get-data";

async function oneDay(iso, attempt = 1) {
  const key = process.env.TRIPLE_WHALE_API_KEY, shop = process.env.TW_SHOP_DOMAIN;
  if (!key || !shop) throw new Error("Triple Whale is not set up. Add TRIPLE_WHALE_API_KEY and TW_SHOP_DOMAIN in Vercel.");
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ shopDomain: shop, period: { start: iso, end: iso }, todayHour: 25 }),
    cache: "no-store",
  });
  if (res.status === 429 && attempt < 3) { await new Promise((r) => setTimeout(r, 1500 * attempt)); return oneDay(iso, attempt + 1); }
  if (res.status === 401 || res.status === 403) throw new Error("Triple Whale rejected the API key. Create a new key with Summary Page: Read and update it in Vercel.");
  if (!res.ok) throw new Error(`Triple Whale error ${res.status} for ${iso}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  const byId = {};
  (data.metrics || []).forEach((m) => { if (m.values && typeof m.values.current === "number") byId[m.id] = m.values.current; });
  const out = {};
  CHANNELS.forEach((ch) => { if (byId[ch.tw] !== undefined) out[ch.key] = byId[ch.tw]; });
  return out;
}

// Returns { iso: { Meta: n, ... } } and fetches a few days at a time.
export async function fetchDays(days) {
  const result = {};
  for (let i = 0; i < days.length; i += 4) {
    const chunk = days.slice(i, i + 4);
    const got = await Promise.all(chunk.map((d) => oneDay(d)));
    chunk.forEach((d, k) => { result[d] = got[k]; });
  }
  return result;
}
