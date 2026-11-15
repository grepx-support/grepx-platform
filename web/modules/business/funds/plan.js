/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A fund's plan and returns: expected EBITDA per use (when it starts, months to reach it), horizon, discount rate,
// share paid out; the projection (payback month, ROI, IRR, NPV, money multiple, cumulative cash against what was put
// in), each use's actual EBITDA against the plan, utilisation, and each investor's expected payout.
import { api, run } from "/assets/app.js";
import { html, icon, kpiRow, lineChart } from "/assets/kit/index.js";
import { cash } from "./common.js";
import { words } from "../lib/words.js";

const useRow = (u = {}) => html`<div class="row pl-use"><label>Use<input name="purpose" list="pl-places" value="${u.purpose || ""}" placeholder="a ${words().place} or project"></label>
  <label>EBITDA a month<input name="monthly_ebitda" type="number" min="0" step="any" value="${u.monthly_ebitda ?? ""}"></label>
  <label>Starts in (months)<input name="starts_in" type="number" min="0" value="${u.starts_in ?? 0}"></label><label>Ramp (months)<input name="ramp" type="number" min="0" value="${u.ramp ?? 3}"></label>
  <button type="button" class="btn small" data-x>×</button></div>`;

function editor(d) {
  const p = d.plan;
  return html`<form class="card pl-form"><h2>${icon("edit")} Plan</h2><datalist id="pl-places">${(d.places || []).map((x) => html`<option value="${x}">`)}</datalist>
    <div class="row"><label>Horizon (months)<input name="horizon" type="number" min="6" max="240" value="${p.horizon}"></label>
      <label>Discount rate % a year<input name="discount_pct" type="number" min="0" step="any" value="${p.discount_pct}"></label>
      <label>EBITDA paid out %<input name="payout_pct" type="number" min="0" max="100" value="${p.payout_pct}"></label>
      <label>Investors' hurdle % a year<input name="hurdle_pct" type="number" min="0" step="any" value="${p.hurdle_pct}"></label></div>
    <div class="pl-uses">${(p.uses.length ? p.uses : [{}]).map(useRow)}</div>
    <p><button type="button" class="btn small" data-add>+ Another use</button> <button class="btn primary">${icon("check", { size: 15 })} Save the plan</button></p>
    ${words().costs_hint ? html`<p class="muted small">${words().costs_hint}</p>` : ""}</form>`;
}

function projection(d, c) {
  const p = d.projection;
  if (!p) return html`<section class="card"><p class="muted">Add the uses and their expected EBITDA to see payback, ROI and IRR.</p></section>`;
  const hurdle = d.plan.hurdle_pct;
  return html`${kpiRow([{ label: "Expected EBITDA a month", value: c(p.expected_ebitda_month), icon: "trend", area: "#16a34a" },
      { label: "Payback", value: p.payback_month ? `month ${p.payback_month}` : "not in the horizon", icon: "clock", area: p.payback_month ? "#0ea5e9" : "#e11d48" },
      { label: "ROI over horizon", value: p.roi_pct == null ? "-" : `${p.roi_pct}%`, icon: "chart", area: "#7c3aed" },
      { label: "IRR a year", value: p.irr_pct == null ? "-" : `${p.irr_pct}%`, icon: "sparkle", area: hurdle && p.irr_pct != null && p.irr_pct < hurdle ? "#e11d48" : "#16a34a",
        note: hurdle ? `hurdle ${hurdle}%` : "" },
      { label: "NPV", value: c(p.npv), icon: "coin", area: p.npv >= 0 ? "#16a34a" : "#e11d48" }, { label: "Money multiple", value: p.multiple ? `${p.multiple}x` : "-", icon: "star", area: "#f59e0b" }])}
    <section class="card"><h2>Cumulative cash back against what was put in</h2>${lineChart({ labels: p.months.map((m) => `M${m.month}`), label: "Projection",
      series: [{ name: "Paid back so far", color: "#0d9488", values: p.months.map((m) => (m.cumulative + d.totals.received) / 100) },
               { name: "Capital put in", color: "#e11d48", values: p.months.map(() => d.totals.received / 100) },
               { name: "EBITDA a month", color: "#f59e0b", values: p.months.map((m) => m.ebitda / 100) }] })}</section>`;
}

export function returnsView(d, c) {
  return html`<div class="fd-two">${editor(d)}<div>${projection(d, c)}
    <section class="card"><h2>${icon("store")} Actual against plan (last 3 months)</h2><table class="kit-table"><thead><tr><th>Use</th><th class="num">Plan a month</th><th class="num">Actual a month</th><th class="num">Of plan</th></tr></thead>
      <tbody>${d.against_plan.map((a) => html`<tr><td>${a.purpose}</td><td class="num">${c(Math.round(a.planned * 100))}</td><td class="num">${a.actual == null ? html`<span class="muted">no data</span>` : c(Math.round(a.actual * 100))}</td>
        <td class="num ${a.pct_of_plan != null && a.pct_of_plan < 80 ? "bad" : "ok"}">${a.pct_of_plan == null ? "-" : `${a.pct_of_plan}%`}</td></tr>`)}</tbody></table></section>
    <section class="card"><h2>${icon("users")} Investors' returns</h2><table class="kit-table"><thead><tr><th>Party</th><th class="num">Put in</th><th class="num">Paid back</th><th class="num">Share</th>
      <th class="num">Expected payout</th><th class="num">Return so far</th></tr></thead><tbody>${d.parties.map((p) => html`<tr><td>${p.name}</td><td class="num">${c(p.received)}</td>
      <td class="num">${c(p.returned)}</td><td class="num">${p.share_pct}%</td><td class="num"><b>${c(p.projected_payout)}</b></td><td class="num">${p.roi_pct == null ? "-" : `${p.roi_pct}%`}</td></tr>`)}</tbody></table></section></div></div>`;
}

export function wirePlan(el, fundId, again) {
  const form = el.querySelector(".pl-form");
  if (!form) return;
  const uses = form.querySelector(".pl-uses");
  form.querySelector("[data-add]").onclick = () => uses.insertAdjacentHTML("beforeend", String(useRow()));
  uses.addEventListener("click", (e) => { if (e.target.closest("[data-x]")) e.target.closest(".pl-use").remove(); });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const n = (name) => Number(form.querySelector(`[name=${name}]`).value || 0);
    const rows = [...uses.querySelectorAll(".pl-use")].map((r) => Object.fromEntries([...r.querySelectorAll("input")].map((i) => [i.name, i.type === "number" ? Number(i.value || 0) : i.value])));
    const body = { horizon: n("horizon"), discount_pct: n("discount_pct"), payout_pct: n("payout_pct"), hurdle_pct: n("hurdle_pct"), uses: rows.filter((r) => r.purpose) };
    if (await run(() => api(`/funds/${fundId}/plan`, { method: "PUT", body }), "Plan saved")) again();
  };
}
