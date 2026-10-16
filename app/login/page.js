"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { window.location.href = "/"; return; }
    setErr((await res.json().catch(() => ({}))).error || "Could not sign in.");
    setBusy(false);
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Ad Spend Sync</h1>
      <div className="field">
        <label className="l" htmlFor="pw">Password</label>
        <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
      </div>
      {err && <div className="note bad">{err}</div>}
      <button className="btn" disabled={busy || !pw}>Sign in</button>
    </form>
  );
}
