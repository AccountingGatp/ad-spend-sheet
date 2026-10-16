import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const page = (body) => new NextResponse(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect Google</title>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px">${body}</body>`,
  { headers: { "content-type": "text/html; charset=utf-8" } });

// Step 2: Google sends you back here. We swap the code for a long-lived key and show it once.
export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return page(`<h2>Not connected</h2><p>Google said: ${esc(url.searchParams.get("error") || "no code returned")}.</p><p><a href="/api/google/connect">Try again</a></p>`);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, grant_type: "authorization_code",
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: url.origin + "/api/google/callback",
    }),
  });
  const j = await res.json();
  if (!res.ok) return page(`<h2>Not connected</h2><p>${esc(j.error_description || j.error)}</p><p><a href="/api/google/connect">Try again</a></p>`);
  if (!j.refresh_token) return page(`<h2>No key returned</h2><p>Google did not return a refresh key. Remove this app at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>, then <a href="/api/google/connect">try again</a>.</p>`);
  return page(`<h2>Google connected</h2>
<p>Copy this value into Vercel: <b>Settings &gt; Environment Variables &gt; New</b>, name <code>GOOGLE_REFRESH_TOKEN</code>. Then redeploy.</p>
<textarea readonly rows="4" style="width:100%;font:13px monospace" onclick="this.select()">${esc(j.refresh_token)}</textarea>
<p>Keep it private. It lets the app open your sheets. You will not see it again.</p>`);
}
