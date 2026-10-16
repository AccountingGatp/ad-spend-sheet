import { NextResponse } from "next/server";
import { makeToken, safeEqual, COOKIE } from "../../../lib/auth";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));
  const { APP_PASSWORD, SESSION_SECRET } = process.env;
  if (!APP_PASSWORD || !SESSION_SECRET) {
    return NextResponse.json({ error: "APP_PASSWORD and SESSION_SECRET are not set in Vercel yet." }, { status: 500 });
  }
  if (!safeEqual(password || "", APP_PASSWORD)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(SESSION_SECRET, 30), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 86400,
  });
  return res;
}
