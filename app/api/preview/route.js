import { NextResponse } from "next/server";
import { parseSheetLink, detectLayout, buildPlan, eachDay } from "../../../lib/plan";
import { pickTab, readGrid } from "../../../lib/google";
import { fetchDays } from "../../../lib/tw";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sydneyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());

// Reads Triple Whale and the sheet, and returns what WOULD change. Writes nothing.
export async function POST(req) {
  try {
    const { link, from, to } = await req.json();
    const p = parseSheetLink(link);
    if (!p) return NextResponse.json({ error: "Paste a valid Google Sheets link first." }, { status: 400 });
    const days = eachDay(from, to);
    if (!days.length) return NextResponse.json({ error: "The end date is before the start date." }, { status: 400 });
    if (days.length > 31) return NextResponse.json({ error: "Pick 31 days or fewer at a time." }, { status: 400 });
    const today = sydneyToday();
    if (days[days.length - 1] >= today) {
      return NextResponse.json({ error: `Triple Whale numbers for ${today} (today) are not final. Pick dates up to yesterday.` }, { status: 400 });
    }

    const { tab } = await pickTab(p.id, p.gid);
    const [values, formulas, tw] = await Promise.all([
      readGrid(p.id, tab, "UNFORMATTED_VALUE"),
      readGrid(p.id, tab, "FORMULA"),
      fetchDays(days),
    ]);
    const layout = detectLayout(values);
    if (layout.error) return NextResponse.json({ error: `${layout.error} Tab checked: "${tab}".` }, { status: 422 });

    const items = buildPlan({ layout, values, formulas, tw, tab });
    return NextResponse.json({ tab, month: layout.month, days, items, tw });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
