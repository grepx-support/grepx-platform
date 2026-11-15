/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What the money is doing, shared by the Funds overview and one fund: suggestions, the cash forecast with its runway
// (three cases), each use's real spending against the money it was given, and the promises board - drag a promise to
// "Paid in" to record the money.
import { api, run } from "/assets/app.js";
import { html, icon, KanbanBoard, lineChart, openDialog, pill } from "/assets/kit/index.js";
import { cash } from "./common.js";
import { words } from "../lib/words.js";

const LEVEL = { act: ["Do now", "bad"], watch: ["Watch", "warn"], idea: ["Idea", "info"] };

export const suggestionCards = (tips, cur) => tips.length ? html`<section class="card k-section"><h2>${icon("alert")} Suggestions</h2><div class="fd-tips">${tips.map((t) =>
  html`<div class="fd-tip fd-${t.level}">${pill(...LEVEL[t.level])}<b>${t.title}</b><p class="muted small">${t.why}</p>${t.amount ? html`<span>${cash(t.amount, cur)}</span>` : ""}</div>`)}</div></section>` : "";

const runwayText = (n) => (n == null ? "lasts the whole year" : n === 0 ? "runs out this month" : `runs out in ${n} month${n === 1 ? "" : "s"}`);

export function forecastCard(fc, cur) {
  const c = fc.cases, labels = c.expected.months.map((m) => m.month.slice(2));
  const line = (k, name, color) => ({ name, color, values: c[k].months.map((m) => Math.max(0, m.closing) / 100) });
  return html`<section class="card k-section"><h2>${icon("trend")} Cash forecast, next 12 months</h2>
    <p class="muted small">Spending ${cash(fc.burn, cur)} a month (the uses' real costs, last three months) plus ${cash(fc.interest, cur)} loan interest.
      Expected: cash ${runwayText(fc.runway.expected)} · worst case ${runwayText(fc.runway.worst)} · best case ${runwayText(fc.runway.best)}.</p>
    ${lineChart({ labels, label: "Cash forecast", series: [line("best", "Best case", "#16a34a"), line("expected", "Expected", "#0ea5e9"), line("worst", "Worst case", "#e11d48")] })}
    <details><summary class="small">Month by month (expected)</summary><table class="m-view"><thead><tr><th>Month</th><th class="end">Start</th><th class="end">In</th><th class="end">Out</th><th class="end">End</th></tr></thead>
      <tbody>${c.expected.months.map((m) => html`<tr><td>${m.month}</td><td class="end">${cash(m.opening, cur)}</td><td class="end">${cash(m.in, cur)}</td><td class="end">${cash(m.out, cur)}</td>
        <td class="end ${m.closing < 0 ? "bad" : ""}">${cash(m.closing, cur)}</td></tr>`)}</tbody></table></details></section>`;
}

export const spendingCard = (uses, cur) => uses.length ? html`<section class="card k-section"><h2>${icon("store")} Money given against real spending</h2>
  ${words().costs_hint ? html`<p class="muted small">${words().costs_hint}</p>` : ""}${uses.map((u) => html`<div class="fd-link">
    <div class="row"><b>${u.purpose}</b><span>${cash(u.spent, cur)} spent of ${cash(u.allocated, cur)} ${u.over ? pill(`over by ${cash(u.spent - u.allocated, cur)}`, "bad") : pill(`${cash(u.left, cur)} left`, "good")}</span></div>
    <div class="fd-bar"><i style="width:${Math.min(100, u.pct || 0)}%" class="${u.over ? "over" : ""}"></i></div>
    <p class="muted small">${u.burn ? `About ${cash(u.burn, cur)} a month. ` : "No costs recorded yet. "}${u.categories.map((c) => `${c.category} ${cash(c.amount, cur)}`).join(" · ")}</p></div>`)}</section>` : "";

/** promises: [{party_id, name, due, missing, overdue, fund_id}]; funds: id -> fund. Drag a promise to "Paid in" to record it. */
export function promisesBoard(host, promises, funds, again) {
  if (!promises.length) return;
  const cards = promises.map((p, n) => ({ ...p, id: `${p.party_id}-${n}`, column: p.overdue ? "late" : "due" }));
  new KanbanBoard({ cards, empty: "Nothing here", columns: [
      { id: "late", title: "Overdue", icon: "alert", color: "#e11d48", accepts: () => false },
      { id: "due", title: "Promised", icon: "clock", color: "#7c3aed", accepts: () => false },
      { id: "in", title: "Paid in", icon: "check", color: "#16a34a", accepts: () => true, hint: "Drop a promise here to record the money" }],
    onOpen: (p) => { location.hash = `#/funds/fund?id=${p.fund_id}&view=advice`; },
    card: (p) => html`<b>${p.name}</b><div>${cash(p.missing, funds[p.fund_id]?.currency)}</div><small class="muted">${funds[p.fund_id]?.name || ""} · due ${p.due}</small>`,
    onMove: async (p) => {
      const box = document.createElement("form");
      box.innerHTML = String(html`<div class="row"><label>Amount<input name="amount" type="number" step="any" min="0.01" value="${p.missing / 100}"></label>
        <label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div><label>Bank reference<input name="ref"></label>`);
      if (await openDialog({ title: `Money in from ${p.name}`, body: box, actions: [{ label: "Cancel", value: "" }, { label: "Record", value: "ok", primary: true }] }) !== "ok") return false;
      const ok = await run(() => api(`/funds/${p.fund_id}/entries`, { method: "POST", body: { ...Object.fromEntries(new FormData(box)), kind: "receive", party_id: p.party_id } }), "Recorded");
      if (ok) setTimeout(again, 400);
      return !!ok;
    } }).mount(host);
}
