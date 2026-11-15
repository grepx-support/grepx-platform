/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What the fund pages share: money from minor units in its own currency, entry kinds and their colours, dialogs.
import { api, run } from "/assets/app.js";
import { html, openDialog } from "/assets/kit/index.js";
import { locale } from "../lib/money.js";
import { words } from "../lib/words.js";

const ZERO = new Set(["JPY", "KRW", "IDR", "VND"]);
export const cash = (minor, cur) => (minor == null ? "-" : new Intl.NumberFormat(locale(cur), { style: "currency", currency: cur || "USD",
  maximumFractionDigits: ZERO.has(cur) || Math.abs(minor) >= 1e7 ? 0 : 2 }).format(minor / (ZERO.has(cur) ? 1 : 100)));   // big sums without cents
export const KIND = { commit: ["Promised", "#7c3aed"], receive: ["Money in", "#16a34a"], allocate: ["Put to use", "#0ea5e9"], release: ["Came back unused", "#14b8a6"], spend: ["Spent (from what was put to use)", "#7c3aed"],
  return: ["Paid back", "#f59e0b"], interest: ["Interest", "#e11d48"], cost: ["Fund cost", "#64748b"] };
export const FUND_KIND = { equity: "Equity (investors / partners)", owner: "Owner's capital", loan: "Loan", grant: "Grant" };

export async function fundDialog(f = {}) {
  const box = document.createElement("form");
  box.innerHTML = String(html`<div class="row"><label>Name<input name="name" required value="${f.name || ""}" placeholder="e.g. Partners' capital 2026"></label>
    <label>Kind<select name="kind">${Object.entries(FUND_KIND).map(([k, v]) => html`<option value="${k}" ${f.kind === k ? "selected" : ""}>${v}</option>`)}</select></label></div>
    <div class="row"><label>Target<input name="target" type="number" min="0" step="any" value="${f.target ? f.target / 100 : ""}"></label>
    <label>Loan rate % a year<input name="rate_pct" type="number" min="0" step="any" value="${f.rate_pct || ""}"></label></div>
    <div class="row"><label>Currency<input name="currency" maxlength="3" value="${f.currency || ""}" placeholder="the business's"></label>
    <label>Rate to the business currency (only if different)<input name="rate_to_base" type="number" min="0" step="any" value="${f.rate_to_base || ""}"></label></div>
    <label>What it is for<input name="purpose" value="${f.purpose || ""}" placeholder="${words().fund_use}"></label>`);
  if (await openDialog({ title: f.fund_id ? "Change the fund" : "New fund", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Save", value: "ok", primary: true }] }) !== "ok") return null;
  return run(() => api("/funds", { method: "POST", body: { ...Object.fromEntries(new FormData(box)), fund_id: f.fund_id } }), "Fund saved");
}

export async function partyDialog() {
  const box = document.createElement("form");
  box.innerHTML = '<div class="row"><label>Name<input name="name" required></label><label>Who<select name="kind"><option value="investor">Investor</option>'
    + '<option value="partner">Partner</option><option value="owner">Owner</option><option value="lender">Lender (bank)</option><option value="grant">Grant giver</option></select></label></div>'
    + '<div class="row"><label>Email<input name="email" type="email"></label><label>Phone<input name="phone"></label></div>';
  if (await openDialog({ title: "Add a party", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Add", value: "ok", primary: true }] }) !== "ok") return null;
  return run(() => api("/funds/parties", { method: "POST", body: Object.fromEntries(new FormData(box)) }), "Added");
}
