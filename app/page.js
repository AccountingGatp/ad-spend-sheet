"use client";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { CHANNELS } from "../lib/plan";

const LS_LINK = "adSpendSheetLink";
const fmt = (n) => n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
const sydneyYesterday = () => {
  const t = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
  return new Date(Date.parse(t + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
};

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) { window.location.href = "/login"; throw new Error("Signed out"); }
  if (!res.ok) throw new Error(j.error || "Something went wrong (" + res.status + ").");
  return j;
}

export default function Home() {
  const [link, setLink] = useState("");
  const [info, setInfo] = useState(null);
  const [infoErr, setInfoErr] = useState("");
  const [checking, setChecking] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [plan, setPlan] = useState(null);
  const [planErr, setPlanErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [feeding, setFeeding] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const y = sydneyYesterday();
    setFrom(y); setTo(y);
    try { const saved = localStorage.getItem(LS_LINK); if (saved) { setLink(saved); checkLink(saved); } } catch {}
  }, []);

  async function checkLink(l = link) {
    setChecking(true); setInfo(null); setInfoErr(""); setPlan(null); setResult(null);
    try {
      const j = await post("/api/sheet-info", { link: l });
      setInfo(j);
      try { localStorage.setItem(LS_LINK, l); } catch {}
      // jump the dates into this sheet's month if they are outside it
      setFrom((f) => (f < j.first || f > j.last ? j.first : f));
      setTo((t) => (t < j.first || t > j.last ? j.first : t));
    } catch (e) { setInfoErr(e.message); }
    setChecking(false);
  }

  async function fetchPreview() {
    setLoading(true); setPlan(null); setPlanErr(""); setResult(null);
    try { setPlan(await post("/api/preview", { link, from, to })); }
    catch (e) { setPlanErr(e.message); }
    setLoading(false);
  }

  const writable = useMemo(
    () => (plan ? plan.items.filter((i) => i.status === "fill" || (overwrite && i.status === "differs")) : []),
    [plan, overwrite]
  );

  async function feed() {
    setFeeding(true); setResult(null);
    try {
      const j = await post("/api/feed", { link, items: writable.map((i) => ({ a1: i.a1, value: i.tw, expected: i.current })) });
      setResult(j);
      setPlan(await post("/api/preview", { link, from, to }));
    } catch (e) { setResult({ error: e.message }); }
    setFeeding(false);
  }

  const outside = info && (from < info.first || to > info.last);
  const dates = plan ? plan.days : [];
  const cell = (iso, ch) => plan.items.find((i) => i.iso === iso && i.channel === ch);
  const count = (s) => (plan ? plan.items.filter((i) => i.status === s).length : 0);

  function renderCell(it) {
    if (!it) return <td />;
    switch (it.status) {
      case "fill": return <td className="fill">{fmt(it.tw)}<small>fill</small></td>;
      case "same": return <td className="same">{fmt(it.tw)}<small>same</small></td>;
      case "differs": return <td className="differs">{fmt(it.tw)}<small>sheet {typeof it.current === "number" ? fmt(it.current) : String(it.current)}</small></td>;
      case "missing": return <td className="bad">none<small>not in Triple Whale</small></td>;
      case "norow": return <td className="same">{it.tw === null ? "-" : fmt(it.tw)}<small>no row in sheet</small></td>;
      case "nodate": return <td className="bad">{it.tw === null ? "-" : fmt(it.tw)}<small>date not in sheet</small></td>;
      case "formula": return <td className="bad">{fmt(it.tw)}<small>cell is a formula</small></td>;
      default: return <td />;
    }
  }

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <h1>Ad Spend Sync</h1>
          <p className="sub">Triple Whale daily ad spend into your monthly Google Sheet.</p>
        </div>
        <div className="nav">
          <a href="/journal.html">Journal tool</a>
          <button onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }}>Sign out</button>
        </div>
      </div>

      <section className="card">
        <h2><span className="step">1</span>Google Sheet for this month</h2>
        <div className="row">
          <div className="field grow">
            <label className="l" htmlFor="link">Sheet link</label>
            <input id="link" type="text" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
          </div>
          <button className="btn" onClick={() => checkLink()} disabled={!link.trim() || checking}>{checking ? "Checking..." : "Save and check"}</button>
        </div>
        {info && (
          <div className="note good">
            <b>This link is {info.month}</b> ({short(info.first)} to {short(info.last)}). File: {info.fileTitle}. Tab: {info.tab}.
            <div className="badges" style={{ marginTop: 8 }}>
              {CHANNELS.map((c) => <span key={c.key} className={"badge " + (info.found[c.key] ? "ok" : "no")}>{c.key}: {info.found[c.key] ? "row found" : "no row"}</span>)}
            </div>
          </div>
        )}
        {infoErr && <div className="note bad">{infoErr}</div>}
        {!info && !infoErr && !checking && <div className="note idle">Paste the link once. It is saved in this browser until you change it next month.</div>}
      </section>

      <section className="card">
        <h2><span className="step">2</span>Dates to fetch</h2>
        <div className="row">
          <div className="field"><label className="l" htmlFor="from">From</label><input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field"><label className="l" htmlFor="to">To</label><input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button className="btn" onClick={fetchPreview} disabled={!info || loading || !from || !to}>{loading ? "Fetching..." : "Fetch from Triple Whale"}</button>
        </div>
        {outside && <div className="note warn">Some of these dates are outside {info.month} ({short(info.first)} to {short(info.last)}). Those cells will be skipped. Use a link for the right month, or change the dates.</div>}
        {planErr && <div className="note bad">{planErr}</div>}
      </section>

      {plan && (
        <section className="card">
          <h2><span className="step">3</span>Preview: nothing is written yet</h2>
          <div className="scroll">
            <table>
              <thead><tr><th>Channel</th>{dates.map((d) => <th key={d}>{short(d)}</th>)}</tr></thead>
              <tbody>{CHANNELS.map((c) => <tr key={c.key}><td>{c.key}</td>{dates.map((d) => <React.Fragment key={d}>{renderCell(cell(d, c.key))}</React.Fragment>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="legend">
            <span><i style={{ background: "var(--good-bg)" }} />Empty cell, will be filled</span>
            <span><i style={{ background: "var(--grey-bg)" }} />Already the same</span>
            <span><i style={{ background: "var(--warn-bg)" }} />Sheet has a different value</span>
            <span><i style={{ background: "var(--bad-bg)" }} />Problem, will be skipped</span>
          </div>
          {count("differs") > 0 && (
            <label className="check"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Also overwrite the {count("differs")} cell(s) where the sheet has a different value</label>
          )}
          <div className="row">
            <button className="btn" onClick={feed} disabled={!writable.length || feeding}>{feeding ? "Writing..." : `Feed data to sheet (${writable.length} cell${writable.length === 1 ? "" : "s"})`}</button>
            <span style={{ color: "var(--muted)" }}>Only these cells are written. Formulas and every other cell are left alone.</span>
          </div>
          {result?.error && <div className="note bad">{result.error}</div>}
          {result && !result.error && (
            <div className={"note " + (result.skipped?.length ? "warn" : "good")}>
              <b>Wrote {result.written} cell(s).</b>
              {result.skipped?.length > 0 && <> Skipped {result.skipped.length}: {result.skipped.slice(0, 6).map((s) => `${s.a1} (${s.reason})`).join(", ")}.</>}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
