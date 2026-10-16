import { NextResponse } from "next/server";
import { parseSheetLink } from "../../../lib/plan";
import { readCells, writeCells } from "../../../lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const isEmpty = (v) => v === undefined || v === null || v === "";

// Writes only the cells the preview approved. Each cell is re-checked first: if it changed
// since the preview, or now holds a formula, it is skipped and nothing else is touched.
export async function POST(req) {
  try {
    const { link, items } = await req.json();
    const p = parseSheetLink(link);
    if (!p) return NextResponse.json({ error: "Paste a valid Google Sheets link first." }, { status: 400 });
    if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: "Nothing to write." }, { status: 400 });
    if (items.length > 400) return NextResponse.json({ error: "Too many cells in one go." }, { status: 400 });

    const ranges = items.map((i) => i.a1);
    const [cur, frm] = await Promise.all([readCells(p.id, ranges, "UNFORMATTED_VALUE"), readCells(p.id, ranges, "FORMULA")]);

    const toWrite = [], skipped = [];
    items.forEach((it, k) => {
      if (typeof it.value !== "number" || !Number.isFinite(it.value)) return skipped.push({ a1: it.a1, reason: "Not a number" });
      if (typeof frm[k] === "string" && frm[k].startsWith("=")) return skipped.push({ a1: it.a1, reason: "Cell contains a formula" });
      const nowEmpty = isEmpty(cur[k]);
      const matches = it.expected === null || it.expected === undefined
        ? nowEmpty
        : !nowEmpty && Math.abs(Number(cur[k]) - Number(it.expected)) < 0.005;
      if (!matches) return skipped.push({ a1: it.a1, reason: "Cell changed since the preview" });
      toWrite.push({ range: it.a1, value: Math.round(it.value * 100) / 100 });
    });

    if (toWrite.length) await writeCells(p.id, toWrite);
    return NextResponse.json({ written: toWrite.length, skipped });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
