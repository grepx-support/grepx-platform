/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Payroll -> Country & rates: one place for the country's statutory rules and every rate (PF, ESI, CPF, super, tax
// slabs...). A changed rate is marked; "default" puts it back. Slabs are edited as [from, value] pairs.
import { api, run } from "/assets/app.js";
import { html, icon, pill } from "/assets/kit/index.js";
import { frame } from "./common.js";

const input = (k, v) => (Array.isArray(v) ? html`<textarea name="${k}" rows="3" class="mono">${JSON.stringify(v)}</textarea>`
  : typeof v === "boolean" ? html`<select name="${k}"><option value="true" ${v ? "selected" : ""}>Yes</option><option value="false" ${v ? "" : "selected"}>No</option></select>`
    : html`<input name="${k}" type="number" step="any" value="${v}">`);
const read = (v, was) => (Array.isArray(was) ? JSON.parse(v) : typeof was === "boolean" ? v === "true" : Number(v));

export async function paySettingsPage(el) {
  const { settings: s, countries } = await api("/payroll/settings");
  const body = frame(el, "payroll", "Country & rates", "Statutory deductions and every rate payroll uses - in one place.",
    html`<a class="btn" href="#/payroll">Back to payroll</a>`);
  body.innerHTML = String(html`<form class="card ps-set"><label>Country<select name="country">${countries.map((c) =>
      html`<option value="${c.code}" ${c.code === s.country ? "selected" : ""}>${c.name}${c.currency ? ` (${c.currency})` : ""}</option>`)}</select></label>
    <p class="muted small">Changing the country loads its rules and default rates. Rates you change are kept per business.</p>
    <div class="ps-rates">${Object.entries(s.rates).map(([k, v]) => html`<div class="ps-rate"><label>${k.replace(/_/g, " ")} ${s.changed.includes(k) ? pill("changed", "warn") : ""}
      ${input(k, v)}</label><span class="muted small">${s.help[k] || ""}</span>${s.changed.includes(k) ? html`<button type="button" class="btn small" data-default="${k}">default</button>` : ""}</div>`)}</div>
    <p><button class="btn primary">${icon("check", { size: 15 })} Save</button></p></form>`);
  const form = body.querySelector("form"), save = (country, rates) => run(() => api("/payroll/settings", { method: "PUT", body: { country, rates } }), "Saved");
  form.country.onchange = async () => { if (await save(form.country.value, {})) paySettingsPage(el); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    let rates;
    try { rates = Object.fromEntries(Object.entries(s.rates).map(([k, was]) => [k, read(form[k].value, was)])); } catch (err) { return alert("A slab is not valid: use [[from, value], ...]"); }
    if (await save(s.country, Object.fromEntries(Object.entries(rates).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(s.rates[k]) || s.changed.includes(k))))) paySettingsPage(el);
  };
  body.querySelectorAll("[data-default]").forEach((x) => x.onclick = async () => { if (await save(s.country, { [x.dataset.default]: null })) paySettingsPage(el); });
}
