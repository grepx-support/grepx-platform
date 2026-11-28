/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// Shared Setup tab (every product), first written for FleetWise.
// Depots, offices and workshops: drag them into the order they appear everywhere; add or edit one.
import { resetBiz } from "/assets/modules/business/lib/business.js";
import { RegionField, stateName } from "../../regions.jsx";
import { SortList, post, values } from "./common.jsx";

const KINDS = [["depot", "Depot (vehicles park here)", "🅿️"], ["office", "Office", "🏢"], ["workshop", "Workshop", "🔧"]];

function LocationForm({ l, country }) {
  const submit = async (e) => {
    e.preventDefault();
    const v = values(e.target);
    if (await post("/setup/locations", { location_id: v.id || undefined, name: v.name, kind: v.kind, region: v.region || "", phone: v.phone, address: v.address,
      active: !v.closed }, "Saved")) { resetBiz(); location.hash = "#/setup?tab=locations"; }
  };
  return (
    <form className="card accent k-section" onSubmit={submit}><h2>{l.id ? `Edit ${l.name}` : "Add a depot, office or workshop"}</h2><input type="hidden" name="id" defaultValue={l.id || ""} />
      <div className="row"><label>Name<input name="name" required defaultValue={l.name || ""} /></label>
        <label>Type<select name="kind" defaultValue={l.kind || "depot"}>{KINDS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <RegionField country={country} value={l.region || ""} /><label>Phone<input name="phone" defaultValue={l.phone || ""} /></label></div>
      <label>Address<input name="address" defaultValue={l.address || ""} /></label>
      {l.id ? <label className="check"><input type="checkbox" name="closed" defaultChecked={l.active === false} /> Closed</label> : null}
      <p><button className="btn primary">Save</button> {l.id ? <a className="btn" href="#/setup?tab=locations">New instead</a> : null}</p></form>
  );
}

export function Locations({ s, q }) {
  const country = s.business.tax?.country || "OTHER";
  const rows = s.locations.map((l) => ({ id: l.id, title: l.name, tag: (KINDS.find(([k]) => k === l.kind) || [null, null, "📍"])[2], off: l.active === false,
    href: `#/setup?tab=locations&edit=${l.id}`, sub: `${l.kind}${l.region ? ` · ${stateName(l.region)}` : ""}${l.active === false ? " · closed" : ""}` }));
  return (
    <>
      <section className="card"><p className="muted">Drag to set the order places appear in pickers and lists.</p>
        <SortList rows={rows} list="locations" empty="No places yet - add your depot." /></section>
      <LocationForm key={q.edit || "new"} l={s.locations.find((l) => l.id === q.edit) || {}} country={country} />
    </>
  );
}
