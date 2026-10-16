import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Step 1 of the one-time Google connection: send you to Google's approval screen.
export async function GET(req) {
  const { GOOGLE_CLIENT_ID } = process.env;
  if (!GOOGLE_CLIENT_ID) return new NextResponse("GOOGLE_CLIENT_ID is not set in Vercel yet.", { status: 500 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: new URL(req.url).origin + "/api/google/callback",
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    access_type: "offline",
    prompt: "consent",
  }).toString();
  return NextResponse.redirect(url);
}
