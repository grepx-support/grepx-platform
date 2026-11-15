/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// One person: profile, the places they work at (home first), pay basis, emergency contact, documents with expiry,
// clock PIN, and leaving. New when there is no id.
import { api, run } from "/assets/app.js";
import { html, icon, pill } from "/assets/kit/index.js";
import { biz } from "../lib/business.js";
import { frame } from "./common.js";
import { mountAttachments } from "../lib/attachments.js";
import { cap, words } from "../lib/words.js";

const field = (label, name, v = "", type = "text", extra = "") => html`<label>${label}<input name="${name}" type="${type}" value="${v ?? ""}" ${extra}></label>`;

export async function personPage(el, q) {
  const b = await biz();
  const p = q.id ? (await api("/team")).team.find((x) => x.employee_id === q.id) || {} : {};
  const pay = p.pay || {};
  const body = frame(el, "people", p.name || "Add a person", p.position || `Profile, ${words().places}, pay and documents`);
  body.innerHTML = String(html`<div class="tm-two"><form class="card tm-form" data-save><h2>${icon("user")} Profile</h2>
      <div class="row">${field("Name", "name", p.name, "text", "required")}${field("Position", "position", p.position, "text", 'list="tm-pos"')}
        <datalist id="tm-pos">${words().positions.map((x) => html`<option value="${x}">`)}</datalist>
        ${field("Phone", "phone", p.phone, "tel")}${field("Email", "email", p.email, "email")}${field("Started", "start_date", p.start_date, "date")}</div>
      <fieldset class="tm-sites"><legend>${cap(words().places)} - the first ticked is the home ${words().place}</legend>${b.locations.map((l) => html`<label class="check">
        <input type="checkbox" name="site" value="${l.id}" ${(p.sites || []).includes(l.id) ? "checked" : ""}> ${l.name}${p.home_site === l.id ? html` ${pill("home", "info")}` : ""}</label>`)}</fieldset>
      <div class="row"><label>Pay basis<select name="basis"><option value="monthly" ${pay.basis !== "hourly" ? "selected" : ""}>Monthly salary</option>
        <option value="hourly" ${pay.basis === "hourly" ? "selected" : ""}>Hourly rate</option></select></label>${field("Rate", "rate", pay.rate, "number", 'min="0" step="0.01"')}
        ${field("Contract hours / week", "weekly_hours", pay.weekly_hours || 48, "number", 'min="0" max="100"')}</div>
      <div class="row">${field("Emergency contact", "em_name", p.emergency?.name)}${field("Their phone", "em_phone", p.emergency?.phone, "tel")}</div>
      <p><button class="btn primary">${icon("check", { size: 15 })} Save</button></p></form>
    ${p.employee_id ? html`<div><section class="card"><h2>${icon("clipboard")} Documents</h2><ul class="tm-docs">${(p.documents || []).map((d) => html`<li>
        ${pill(d.state.replace("_", " "), { expired: "bad", expiring: "warn", valid: "good" }[d.state] || "")} <b>${d.kind}</b> ${d.number || ""}
        <span class="muted small">${d.expires_on ? `until ${d.expires_on}` : ""}</span> <button class="btn small" data-rm="${d.doc_id}">Remove</button></li>`)}</ul>
        <form class="row" data-doc>${field("Document", "kind", "", "text", 'required list="tm-doc"')}<datalist id="tm-doc">${words().documents.map((x) => html`<option value="${x}">`)}</datalist>${field("Number", "number")}${field("Expires", "expires_on", "", "date")}
          <button class="btn">Add</button></form></section>
      <section class="card"><h2>${icon("clock")} Clock PIN</h2><form class="row" data-pin>${field("New 4-6 digit PIN", "pin", "", "password", 'inputmode="numeric" pattern="[0-9]{4,6}" required')}
        <button class="btn">Set PIN</button></form></section>
      ${p.active !== false ? html`<section class="card"><h2>Leaving</h2><form class="row" data-end>${field("Last day", "end_date", "", "date", "required")}${field("Reason", "reason")}
        <button class="btn danger">Record leaving</button></form></section>` : html`<section class="card"><p>Left on ${p.end_date}. ${p.end_reason || ""}</p></section>`}</div>` : ""}</div>`);
  const again = (id) => { location.hash = `#/team/person?id=${id}`; personPage(el, { id }); };
  const on = (sel, fn) => body.querySelector(sel)?.addEventListener("submit", async (e) => { e.preventDefault(); await fn(Object.fromEntries(new FormData(e.target)), e.target); });
  on("[data-save]", async (f, form) => {
    const sites = [...form.querySelectorAll("[name=site]:checked")].map((c) => c.value);
    const saved = await run(() => api("/team", { method: "POST", body: { employee_id: p.employee_id, name: f.name, position: f.position, phone: f.phone, email: f.email,
      start_date: f.start_date, sites, home_site: sites.includes(p.home_site) ? p.home_site : sites[0] || "", emergency: { name: f.em_name, phone: f.em_phone },
      pay: { basis: f.basis, rate: Number(f.rate || 0), weekly_hours: Number(f.weekly_hours || 0) } } }), "Saved");
    if (saved) again(saved.employee_id);
  });
  on("[data-doc]", async (f) => { if (await run(() => api(`/team/${p.employee_id}/documents`, { method: "POST", body: f }), "Document added")) again(p.employee_id); });
  on("[data-pin]", async (f, form) => { if (await run(() => api(`/team/${p.employee_id}/pin`, { method: "POST", body: f }), "PIN set")) form.reset(); });
  on("[data-end]", async (f) => { if (await run(() => api(`/team/${p.employee_id}/end`, { method: "POST", body: f }), "Recorded")) again(p.employee_id); });
  body.querySelectorAll("[data-rm]").forEach((x) => x.addEventListener("click", async () => {
    if (await run(() => api(`/team/${p.employee_id}/documents/${x.dataset.rm}`, { method: "DELETE" }), "Removed")) again(p.employee_id);
  }));
  if (p.employee_id) mountAttachments(body.appendChild(document.createElement("div")), `employee:${p.employee_id}`, { title: "Other files" });
}
