import { NextResponse } from "next/server";
import { CHANNELS, parseSheetLink, detectLayout } from "../../../lib/plan";
import { pickTab, readGrid } from "../../../lib/google";

export const dynamic = "force-dynamic";

// Opens the pasted sheet link and says which month it is, from the dates in the sheet itself.
export async function POST(req) {
  try {
    const { link } = await req.json();
    const p = parseSheetLink(link);
    if (!p) return NextResponse.json({ error: "That does not look like a Google Sheets link. It should contain /spreadsheets/d/..." }, { status: 400 });
    const { fileTitle, tab } = await pickTab(p.id, p.gid);
    const L = detectLayout(await readGrid(p.id, tab, "UNFORMATTED_VALUE"));
    if (L.error) return NextResponse.json({ error: `${L.error} Tab checked: "${tab}". The sheet layout may have changed.` }, { status: 422 });
    return NextResponse.json({
      fileTitle, tab, month: L.month, first: L.first, last: L.last,
      found: Object.fromEntries(CHANNELS.map((c) => [c.key, L.rows[c.key] !== undefined])),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
