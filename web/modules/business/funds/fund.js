/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// One fund: its totals, each party's promise / paid / pending / share, where the money went, month by month, and
// every movement (newest first, reversible). Record a movement from the top.
import { api, run } from "/assets/app.js";
import { DataTable, html, icon, kpiRow, openDialog, pageHead, pill } from "/assets/kit/index.js";
import { area, head } from "../lib/areas.js";
import { KIND, cash, fundDialog } from "./common.js";
import { returnsView, wirePlan } from "./plan.js";
import { balanceSheet } from "./balance.js";
import { forecastCard, promisesBoard, spendingCard, suggestionCards } from "./insight.js";
import { statementActions, statementClick } from "./statement.js";
import { downloadCsv } from "../lib/csv.js";
import { tabs } from "/assets/kit/index.js";
import { showDetails } from "../lib/details.js";
import { words } from "../lib/words.js";

async function move(f, people) {
  const box = document.createElement("form");
  box.innerHTML = String(html`<div class="row"><label>What happened<select name="kind">${Object.entries(KIND).map(([k, [label]]) => html`<option value="${k}">${label}</option>`)}</select></label>
    <label>Amount<input name="amount" type="number" min="0.01" step="any" required></label>
    <label>Currency<input name="currency" value="${f.currency}" maxlength="3" style="width:6em"></label><label>Rate to ${f.currency}<input name="rate" type="number" step="any" min="0" placeholder="only if another currency"></label><label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
    <div class="row"><label>Party<select name="party_id"><option value="">-</option>${people.map((p) => html`<option value="${p.party_id}">${p.name}</option>`)}</select></label>
    <label>Due by (promises)<input name="due" type="date"></label><label>Used for<input name="purpose" placeholder="${words().fund_use}"></label></div>
    <div class="row"><label>Reference<input name="ref" placeholder="bank ref, cheque no."></label><label>Note<input name="note"></label></div>`);
  if (await openDialog({ title: `Record - ${f.name}`, body: box, actions: [{ label: "Cancel", value: "" }, { label: "Record", value: "ok", primary: true }] }) !== "ok") return null;
  return run(() => api(`/funds/${f.fund_id}/entries`, { method: "POST", body: Object.fromEntries(new FormData(box)) }), "Recorded");
}

export async function fundPage(el, q) {
  const d = await api(`/funds/${encodeURIComponent(q.id)}`);
  const f = d.fund, t = d.totals, c = (x) => cash(x, f.currency);
  const top = Math.max(1, ...d.months.map((m) => Math.max(m.in, m.out)));
  const view = q.view || "position", link = (v) => `#/funds/fund?id=${f.fund_id}&view=${v}`;
  const TABS = [{ id: "position", label: "Position", icon: "coin", href: link("position") }, { id: "advice", label: "Forecast & advice", icon: "alert", href: link("advice") },
    { id: "returns", label: "Plan & returns", icon: "trend", href: link("returns") }];
  el.style.setProperty("--area", area("funds"));
  el.innerHTML = String(html`${pageHead({ ...head("funds"), title: f.name, subtitle: `${f.currency}${f.purpose ? ` · ${f.purpose}` : ""}${f.rate_pct ? ` · ${f.rate_pct}% a year` : ""}`,
    actions: html`<a class="btn" href="#/funds">All funds</a><button class="btn" data-edit>${icon("edit", { size: 15 })} Change</button><button class="btn primary" data-move>${icon("plus", { size: 15 })} Record</button>` })}
    ${kpiRow([{ label: "Promised", value: c(t.committed), icon: "clipboard", area: "#7c3aed" }, { label: "Brought in", value: c(t.received), icon: "inbox", area: "#16a34a" },
      { label: "Pending", value: c(t.pending), icon: "clock", area: t.pending ? "#f59e0b" : "#94a3b8" }, { label: "Put to use", value: c(t.allocated), icon: "store", area: "#0ea5e9" },
      { label: "Available", value: c(t.available), icon: "coin", area: area("funds") },
      { label: "Utilised", value: t.utilised_pct == null ? "-" : `${t.utilised_pct}%`, icon: "check", area: "#7c3aed", note: `${c(t.spent)} spent` }, ...(f.kind === "loan" ? [{ label: "Still owed", value: c(t.owed), icon: "alert", area: "#e11d48" }] : [])])}
    ${tabs(TABS, view)}${view === "advice" ? html`${suggestionCards(d.suggestions, f.currency)}${spendingCard(d.linked, f.currency)}${forecastCard(d.forecast, f.currency)}
      ${d.promises.length ? html`<section class="card k-section"><h2>${icon("clock")} Promises to collect</h2><div data-board></div></section>` : ""}${balanceSheet({ [f.currency]: d.balance_sheet })}`
    : view === "returns" ? returnsView(d, c) : html`<div class="fd-two"><section class="card"><h2>${icon("users")} Who put money in</h2><table class="kit-table"><thead><tr><th>Party</th><th class="num">Promised</th><th class="num">In</th>
        <th class="num">Pending</th><th class="num">Paid back</th><th class="num">Share</th></tr></thead><tbody>${d.parties.map((p) => html`<tr><td>${p.name} ${statementActions(p)}</td><td class="num">${c(p.committed)}</td>
        <td class="num">${c(p.received)}</td><td class="num ${p.pending ? "warn" : ""}">${c(p.pending)}</td><td class="num">${c(p.returned)}</td><td class="num"><b>${p.share_pct}%</b></td></tr>`)}</tbody></table>
        ${d.overdue.map((o) => html`<p class="bad small">${o.name}: ${c(o.missing)} was due ${o.due}</p>`)}</section>
      <section class="card"><h2>${icon("store")} Where it went</h2>${d.uses.map((u) => html`<div class="fd-use"><span>${u.purpose}</span><i><b style="width:${Math.round(u.amount / Math.max(1, t.allocated) * 100)}%"></b></i><span>${c(u.amount)}</span></div>`)}
        ${d.utilisation.length ? html`<h3>Utilisation (spent of what was put to use)</h3>${d.utilisation.map((u) => html`<div class="fd-use"><span>${u.purpose}</span>
          <i><b style="width:${Math.min(100, u.pct || 0)}%;background:#7c3aed"></b></i><span>${u.pct == null ? "-" : `${u.pct}%`}</span></div>`)}` : ""}
        <h3>Month by month</h3><div class="fd-months">${d.months.map((m) => html`<div title="${m.month}: in ${c(m.in)}, out ${c(m.out)}"><i class="in" style="height:${m.in / top * 100}%"></i><i class="out" style="height:${Math.max(0, m.out) / top * 100}%"></i><span>${m.month.slice(2)}</span></div>`)}</div></section></div>
    <section class="card k-section"><h2>Every movement <button class="btn small" data-csv>${icon("download", { size: 14 })} CSV</button></h2><div class="t"></div></section>`}`);
  const again = () => fundPage(el, q);
  if (view === "advice") {
    if (d.promises.length) promisesBoard(el.querySelector("[data-board]"), d.promises, { [f.fund_id]: f }, again);
    el.querySelector("[data-move]").onclick = async () => { if (await move(f, d.people)) again(); };
    el.querySelector("[data-edit]").onclick = async () => { if (await fundDialog(f)) again(); };
    return;
  }
  if (view === "returns") return wirePlan(el, f.fund_id, again) || el.querySelector("[data-move]").addEventListener("click", async () => { if (await move(f, d.people)) again(); });
  new DataTable({ onRow: (e) => showDetails(`${e.date} - ${e.kind}`, e), rows: d.entries, columns: [
    { key: "date", label: "Date" }, { key: "kind", label: "What", render: (e) => html`<span class="fd-kind" style="--k:${KIND[e.kind][1]}">${KIND[e.kind][0]}</span>${e.reversed ? html` ${pill("reversed", "")}` : ""}` },
    { key: "amount", label: "Amount", render: (e) => html`<b class="${e.reversed ? "muted" : ""}">${c(e.amount)}</b>` }, { key: "party", label: "Party" },
    { key: "purpose", label: "Used for" }, { key: "ref", label: "Ref" }, { key: "by", label: "By" },
    { key: "x", label: "", render: (e) => html`${e.reversed ? "" : html`<button class="btn small" data-rev="${e.entry_id}">Reverse</button>`}` }] }).mount(el.querySelector(".t"));
  el.querySelector("[data-move]").onclick = async () => { if (await move(f, d.people)) again(); };
  el.querySelector("[data-edit]").onclick = async () => { if (await fundDialog(f)) again(); };
  el.querySelector(".fd-two").addEventListener("click", (e) => statementClick(e));
  const table = (objs) => (objs.length ? [Object.keys(objs[0]), ...objs.map(Object.values)] : []);
  el.querySelector("[data-csv]").onclick = () => downloadCsv(`${f.name}-movements.csv`, table(d.entries.map((e) => ({ date: e.date, what: KIND[e.kind][0], amount: e.amount / 100,
    currency: e.currency, paid_as: e.original ? `${e.original.amount / 100} ${e.original.currency} @ ${e.original.rate}` : "", party: e.party, used_for: e.purpose,
    ref: e.ref, note: e.note, by: e.by, reversed: e.reversed ? "yes" : "" }))));
  el.querySelector(".t").addEventListener("click", async (e) => {
    const id = e.target.closest("[data-rev]")?.dataset.rev;
    if (id && await run(() => api(`/funds/entries/${id}/reverse`, { method: "POST", body: { reason: "reversed" } }), "Reversed")) again();
  });
}
