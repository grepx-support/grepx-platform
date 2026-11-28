/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Platform operator (GrepX): every business on the platform, opening one (read only or to fix), closing and reopening, and
// setting up a new one with its owner's login - the same page in every product. A product passes its words and any extra
// sections (FleetWise: the postal code upload):
//   <Businesses words={WORDS} extra={<PostalCodes />} />
import { useState } from "react";
import { enterSupport } from "/assets/app.js";
import { Icon, KpiRow, PageHead, Password } from "../kit.jsx";
import { Loaded, useArea, useLoad } from "../hooks.jsx";
import { area, head } from "../areas.js";
import { api, confirm, run } from "../shell.js";

export const BUSINESS_WORDS = {
  places: "Offices", placesArea: "setup", newTitle: "Set up a new business", nameLabel: "Business name", create: "Create business",
  demo: ["Demo company", "with sample data"], empty: ["Empty company", "for the owner's own data"], roles: "Creates the business, its roles and the owner's login.", demoNote: "",
};

function NewBusiness({ words: w, onMade }) {
  const submit = async (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    if (await run(() => api("/platform/businesses", { method: "POST", body: { name: d.get("name"), currency: d.get("currency"), timezone: d.get("timezone"),
      owner: { name: d.get("oname"), email: d.get("email"), phone: d.get("phone"), password: d.get("password") }, start_with: d.get("start_with") } }),
    d.get("start_with") === "demo" ? "Business created - filling it with sample data (about a minute)" : "Business created")) onMade();
  };
  return (
    <form className="card accent k-section" onSubmit={submit}><h2>{w.newTitle}</h2>
      <div className="row"><label>{w.nameLabel}<input name="name" required /></label>
        <label>Currency<input name="currency" required maxLength={3} placeholder="SGD" /></label><label>Time zone<input name="timezone" required placeholder="Asia/Singapore" /></label></div>
      <h2 className="k-section">Owner</h2>
      <div className="row"><label>Name<input name="oname" required /></label><label>Email (login)<input name="email" type="email" required /></label>
        <label>Phone<input name="phone" required placeholder="+65 9123 4567" /></label><label>Password (8+)<Password name="password" minLength={8} required /></label></div>
      <h2 className="k-section">Start with</h2>
      <div className="row"><label className="check"><input type="radio" name="start_with" value="demo" defaultChecked /> <b>{w.demo[0]}</b> - {w.demo[1]}</label>
        <label className="check"><input type="radio" name="start_with" value="empty" /> <b>{w.empty[0]}</b> - {w.empty[1]}</label></div>
      <p><button className="btn primary">{w.create}</button></p>
      <p className="muted small">{w.roles}{w.demoNote ? <>{" "}{w.demoNote}</> : null}</p></form>
  );
}

export function Businesses({ words = BUSINESS_WORDS, extra = null }) {
  const w = { ...BUSINESS_WORDS, ...words };
  const load = useLoad(() => api("/platform/businesses"), []);
  const [fresh, setFresh] = useState(0);
  useArea(area("platform"));
  return (
    <Loaded state={load}>{(all) => {
      const list = all.filter((b) => !b.closed), closed = all.filter((b) => b.closed);
      const open = async (b, edit) => {
        if (edit && !(await confirm({ title: `Change ${b.name}'s data?`, ok: "Open to fix",
          text: "You can change anything in this business for one hour. Every change is saved under your name and the opening is audited." }))) return;
        const s = await run(() => api(`/platform/businesses/${b.id}/support`, { method: "POST", body: { edit } }));
        if (s) enterSupport(s, s.business_name);
      };
      const close = async (b) => {
        if (!(await confirm({ title: `Close ${b.name}?`, ok: "Close business", danger: true,
          text: "Its owner and staff can no longer sign in to use the app. Nothing is deleted: you can reopen it from this page." }))) return;
        if (await run(() => api(`/platform/businesses/${b.id}/close`, { method: "POST", body: {} }), `${b.name} closed`)) load.reload();
      };
      const reopen = async (b) => { if (await run(() => api(`/platform/businesses/${b.id}/reopen`, { method: "POST", body: {} }), "Reopened")) load.reload(); };
      return (
        <>
          <PageHead {...head("platform")} title="Businesses" subtitle="Every business on the platform. Each one sees only its own data." />
          <KpiRow items={[{ label: "Businesses", value: list.length, icon: "building", area: area("platform") },
            { label: w.places, value: list.reduce((a, b) => a + (b.locations || 0), 0), icon: "pin", area: area(w.placesArea) }]} />
          <div className="grid">{list.map((b) => (
            <article className="card accent" key={b.id}><h2>{b.name}</h2><p className="muted">{b.currency} · {b.timezone}</p><span className="badge">{b.locations} locations</span>
              <div className="row k-section"><button className="btn primary" onClick={() => open(b, false)}><Icon name="eyeoff" size={15} /> Open (read only)</button>
                <button className="btn" onClick={() => open(b, true)}><Icon name="settings" size={15} /> Open to fix</button>
                <button className="btn danger" onClick={() => close(b)}><Icon name="x" size={15} /> Close</button></div></article>))}</div>
          {closed.length ? (
            <section className="card k-section"><h2>Closed businesses</h2><p className="muted small">Their people cannot use the app. Nothing was deleted - reopen to bring one back.</p>
              {closed.map((b) => (
                <div className="k-row" key={b.id}><b>{b.name}</b><span className="muted">{b.currency} · closed {(b.closed_at || "").slice(0, 10)}</span>
                  <button className="btn small" onClick={() => reopen(b)}><Icon name="refresh" size={14} /> Reopen</button></div>))}</section>
          ) : null}
          <NewBusiness key={fresh} words={w} onMade={() => { setFresh(fresh + 1); load.reload(); }} />
          {extra}
        </>
      );
    }}</Loaded>
  );
}
