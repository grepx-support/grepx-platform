/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Funds: the whole money picture in the business currency - what to do (suggestions), how long the cash lasts
// (forecast), what each use really spent against what it was given, promises to collect (drag to "Paid in"), the fund
// cards (drag to reorder; drag a card onto a place to put money to it) and the balance sheet as of any date.
import { api, run } from "/assets/app.js";
import { empty, html, icon, kpiRow, openDialog, pageHead } from "/assets/kit/index.js";
import { area, head } from "../lib/areas.js";
import { balanceSheet } from "./balance.js";
import { FUND_KIND, cash, fundDialog, partyDialog } from "./common.js";
import { forecastCard, promisesBoard, spendingCard, suggestionCards } from "./insight.js";

const card = (f) => html`<a class="card fd-card fd-${f.kind}" data-id="${f.fund_id}" draggable="true" href="#/funds/fund?id=${f.fund_id}">
  <header><b>${f.name}</b><span class="muted small">${FUND_KIND[f.kind]}${f.currency ? ` · ${f.currency}` : ""}</span></header>
  <div class="fd-big">${cash(f.received, f.currency)}<span class="muted small"> in</span></div>
  ${f.target_progress != null ? html`<div class="fd-bar"><i style="width:${Math.min(100, f.target_progress)}%"></i></div><p class="muted small">${f.target_progress}% of ${cash(f.target, f.currency)} target</p>` : ""}
  <dl class="fd-mini"><dt>Promised, not in yet</dt><dd class="${f.pending ? "warn" : ""}">${cash(f.pending, f.currency)}</dd><dt>Put to use</dt><dd>${cash(f.allocated, f.currency)}</dd>
    <dt>Available</dt><dd><b>${cash(f.available, f.currency)}</b></dd>${f.kind === "loan" ? html`<dt>Still owed</dt><dd class="bad">${cash(f.owed, f.currency)}</dd>` : ""}</dl></a>`;

async function allocate(f, place, again) {
  const box = document.createElement("form");
  box.innerHTML = String(html`<p>From <b>${f.name}</b> (available ${cash(f.available, f.currency)}) to <b>${place}</b>.</p>
    <div class="row"><label>Amount (${f.currency})<input name="amount" type="number" min="0.01" step="any" required></label>
    <label>Date<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div><label>Note<input name="note"></label>`);
  if (await openDialog({ title: "Put money to use", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Put to use", value: "ok", primary: true }] }) !== "ok") return;
  if (await run(() => api(`/funds/${f.fund_id}/entries`, { method: "POST", body: { ...Object.fromEntries(new FormData(box)), kind: "allocate", purpose: place } }), "Put to use")) again();
}

function reorder(ids, moved, before, again) {
  const rest = ids.filter((id) => id !== moved);
  rest.splice(rest.indexOf(before), 0, moved);
  run(() => api("/funds/order", { method: "POST", body: { fund_ids: rest } }), "Order saved").then((ok) => ok && again());
}

/** One drag: drop a fund card on another card to move it there, or on a place to put money to that place. */
function wireDrops(el, funds, again) {
  let dragged = null;
  const cards = [...el.querySelectorAll(".fd-card")];
  cards.forEach((c) => {
    c.addEventListener("dragstart", (e) => { dragged = funds[c.dataset.id]; e.dataTransfer.setData("text/plain", c.dataset.id); c.classList.add("dragging"); });
    c.addEventListener("dragend", () => { c.classList.remove("dragging"); dragged = null; });
    c.addEventListener("dragover", (e) => { if (dragged && dragged.fund_id !== c.dataset.id) { e.preventDefault(); c.classList.add("on"); } });
    c.addEventListener("dragleave", () => c.classList.remove("on"));
    c.addEventListener("drop", (e) => { e.preventDefault(); c.classList.remove("on"); if (dragged) reorder(cards.map((x) => x.dataset.id), dragged.fund_id, c.dataset.id, again); });
  });
  el.querySelectorAll("[data-place]").forEach((z) => {
    z.addEventListener("dragover", (e) => { if (dragged) { e.preventDefault(); z.classList.add("on"); } });
    z.addEventListener("dragleave", () => z.classList.remove("on"));
    z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("on"); if (dragged) allocate(dragged, z.dataset.place, again); dragged = null; });
  });
}

export async function fundsPage(el, q = {}) {
  const o = await api(`/funds${q.as_of ? `?as_of=${q.as_of}` : ""}`);
  const cur = o.base || o.currency, t = o.in_base, p = o.position, funds = Object.fromEntries(o.funds.map((f) => [f.fund_id, f]));
  const again = () => fundsPage(el, q);
  el.style.setProperty("--area", area("funds"));
  el.innerHTML = String(html`${pageHead({ ...head("funds"), title: "Funds", subtitle: "Money brought in, promised, put to use, spent and paid back - and what to do next.",
    actions: html`<button class="btn" data-party>${icon("users", { size: 15 })} Add a party</button><button class="btn primary" data-fund>${icon("plus", { size: 15 })} New fund</button>` })}
    ${kpiRow([{ label: "Brought in", value: cash(t.received, cur), icon: "inbox", area: "#16a34a" },
      { label: "Promised, not in yet", value: cash(t.pending, cur), icon: "clock", area: "#7c3aed", note: o.overdue.length ? `${o.overdue.length} overdue` : "", tone: o.overdue.length ? "bad" : "" },
      { label: "Put to use", value: cash(t.allocated, cur), icon: "store", area: "#0ea5e9", note: `${cash(p.linked.reduce((s, u) => s + u.spent, 0), cur)} really spent` },
      { label: "Available", value: cash(t.available, cur), icon: "coin", area: area("funds") },
      { label: "Runway", value: p.forecast.runway.expected == null ? "12+ months" : `${p.forecast.runway.expected} months`, icon: "trend", area: "#e11d48", note: `burn ${cash(p.forecast.burn, cur)}/month` },
      { label: "Loans owed", value: cash(t.owed, cur), icon: "alert", area: "#f59e0b" }])}
    ${t.unconverted.length ? html`<p class="muted small">Not in the totals (set their rate to ${cur}): ${t.unconverted.join(", ")}</p>` : ""}
    ${suggestionCards(p.suggestions, cur)}
    ${o.funds.length ? html`<h2 class="k-section">Funds <span class="muted small">drag to reorder · drag a fund onto a place to put money to it</span></h2>
      <div class="fd-grid fd-sort">${o.funds.map(card)}</div>
      <div class="fd-places">${(o.places || []).map((pl) => html`<div class="fd-drop" data-place="${pl}">${icon("store", { size: 15 })} ${pl}</div>`)}</div>`
      : empty({ icon: "coin", title: "No funds yet", text: "Add a fund: partners' capital, an investor round, a bank loan or a grant." })}
    ${spendingCard(p.linked, cur)}
    ${o.funds.length ? forecastCard(p.forecast, cur) : ""}
    ${p.promises.length ? html`<section class="card k-section"><h2>${icon("clock")} Promises to collect</h2><div data-board></div></section>` : ""}
    ${o.funds.length ? html`<div class="row"><label>Balance sheet as of<input type="date" name="as_of" value="${q.as_of || ""}"></label></div>${balanceSheet(o.balance_sheet)}` : ""}`);
  el.querySelector("[data-fund]").onclick = async () => { if (await fundDialog()) again(); };
  el.querySelector("[data-party]").onclick = async () => { if (await partyDialog()) again(); };
  wireDrops(el, funds, again);
  const board = el.querySelector("[data-board]");
  if (board) promisesBoard(board, p.promises, funds, again);
  el.querySelector("[name=as_of]")?.addEventListener("change", (e) => fundsPage(el, { ...q, as_of: e.target.value }));
}
