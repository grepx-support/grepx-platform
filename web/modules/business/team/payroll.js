/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Payroll: the month's run - work it out (again until locked), bonuses and advances, every payslip, lock the month
// (and whatever the product adds, e.g. labour cost into Costs). Country and rates: team/pay-settings.js.
import { api, run } from "/assets/app.js";
import { DataTable, empty, html, icon, kpiRow, openDialog, pill } from "/assets/kit/index.js";
import { biz } from "../lib/business.js";
import { money } from "../lib/format.js";
import { addDays, frame } from "./common.js";
import { pickChannels } from "../lib/channels.js";
import { showPayslip } from "./payslip.js";
import { words } from "../lib/words.js";

const shift = (m, n) => addDays(`${m}-15`, n * 30).slice(0, 7);

async function adjust(month, team) {
  const box = document.createElement("form");
  box.innerHTML = String(html`<div class="row"><label>Person<select name="employee_id">${team.map((p) => html`<option value="${p.employee_id}">${p.name}</option>`)}</select></label>
    <label>What<select name="kind"><option value="bonus">Bonus (adds)</option><option value="advance">Advance to recover</option><option value="deduction">Other deduction</option></select></label>
    <label>Amount<input name="amount" type="number" min="0.01" step="0.01" required></label></div><label>Note<input name="note" placeholder="e.g. Diwali bonus"></label>`);
  if (await openDialog({ title: `Add to ${month}`, body: box, actions: [{ label: "Cancel", value: "" }, { label: "Add", value: "ok", primary: true }] }) !== "ok") return null;
  return run(() => api("/payroll/adjust", { method: "POST", body: { ...Object.fromEntries(new FormData(box)), month } }), "Added");
}

/** Send a locked month's payslips (everyone, or the ids given) with the PDF attached; says who could not be reached. */
async function send(month, ids) {
  const channels = await pickChannels({ title: ids ? "Send payslip" : `Send ${month} payslips`, ticked: ["email"],
    text: ids ? "The payslip goes to the person on each channel ticked." : "Each person gets their own payslip on each channel ticked that they have an address for." });
  if (!channels) return false;
  const out = await run(() => api("/payroll/payslips/send", { method: "POST", body: { month, channels, ...(ids ? { employee_ids: ids } : {}) } }));
  if (!out) return false;
  const missed = out.results.filter((r) => !r.ok);
  await openDialog({ title: `${out.sent} payslip${out.sent === 1 ? "" : "s"} sent`, body: missed.length
    ? html`<p>Not sent:</p><ul>${missed.map((r) => html`<li>${r.name || r.employee_id}: ${r.message}</li>`)}</ul>` : html`<p>Everyone was sent their payslip.</p>`,
    actions: [{ label: "OK", value: "", primary: true }] });
  return true;
}

export async function payrollPage(el, q) {
  const b = await biz();
  const month = q.month || new Date().toISOString().slice(0, 7);
  const [m, t, st] = await Promise.all([api(`/payroll?month=${month}`), api("/team"), api("/payroll/settings")]);
  const r = m.run, locked = r?.final;
  const body = frame(el, "payroll", "Payroll", `${month} · ${st.settings.country_name}${locked ? " · locked" : r ? " · draft" : ""}`,
    html`<a class="btn" href="#/payroll?month=${shift(month, -1)}">‹</a><a class="btn" href="#/payroll?month=${shift(month, 1)}">›</a>
      <a class="btn" href="#/payroll/settings">${icon("settings", { size: 15 })} Country & rates</a>
      ${locked ? html`<button class="btn primary" data-send-all>${icon("send", { size: 15 })} Send payslips…</button>` : ""}
      ${locked ? "" : html`<button class="btn" data-adj>${icon("plus", { size: 15 })} Bonus / advance</button><button class="btn" data-run>${icon("refresh", { size: 15 })} Work out</button>
        ${r ? html`<button class="btn primary" data-lock>${icon("lock", { size: 15 })} Lock month</button>` : ""}`}`);
  body.innerHTML = String(html`${kpiRow([{ label: "People paid", value: r?.people ?? 0, icon: "users", area: "#0891b2" },
      { label: "Gross pay", value: money(b, r?.gross), icon: "coin", area: "#16a34a" }, { label: "Net pay", value: money(b, r?.net), icon: "receipt", area: "#7c3aed" },
      { label: "Cost to business", value: money(b, r?.cost), icon: "chart", area: "#e11d48" }])}
    ${m.adjustments.length ? html`<section class="card"><h2>Bonuses and deductions</h2>${m.adjustments.map((a) => html`<span class="kit-chip">${pill(a.kind, a.kind === "bonus" ? "good" : "warn")}
      ${t.team.find((p) => p.employee_id === a.employee_id)?.name} ${money(b, a.amount)} ${a.note}${locked ? "" : html` <button class="btn small" data-rm="${a.adjustment_id}">×</button>`}</span>`)}</section>` : ""}
    <section class="card k-section">${m.payslips.length ? html`<div class="t"></div>` : empty({ icon: "coin", title: "Not worked out yet",
      text: "Press Work out: pay from salaries or clocked hours, unpaid leave, bonuses and the country's deductions." })}</section>`);
  const again = () => payrollPage(el, q);
  if (m.payslips.length) {
    new DataTable({ onRow: (s, tr) => tr.querySelector("[data-slip]")?.click(), rows: m.payslips, columns: [
      { key: "name", label: "Person", render: (s) => html`<a href="javascript:void 0" data-slip="${s.employee_id}"><b>${s.name}</b></a> <span class="muted small">${s.position}</span>` },
      { key: "worked_hours", label: "Hours", render: (s) => html`${s.worked_hours || ""}` },
      { key: "gross", label: "Gross", render: (s) => html`${money(b, s.gross)}` },
      { key: "deductions", label: "Deductions", render: (s) => html`${money(b, s.deductions.reduce((x, l) => x + l.amount, 0))}` },
      { key: "net", label: "Net", render: (s) => html`<b>${money(b, s.net)}</b>` },
      { key: "cost", label: "Cost", render: (s) => html`${money(b, s.cost)}` },
      { key: "sent", label: "Sent", render: (s) => html`${s.sent?.length ? pill(s.sent.at(-1).channels.join(", "), "good") : html`<span class="muted small">${locked ? "not yet" : "-"}</span>`}` }] })
      .mount(body.querySelector(".t"));
    body.querySelector(".t").addEventListener("click", (e) => { const s = m.payslips.find((x) => x.employee_id === e.target.closest("[data-slip]")?.dataset.slip); if (s) showPayslip(b, s, locked && (() => send(month, [s.employee_id]).then(again))); });
  }
  const press = (sel, fn) => el.querySelector(sel)?.addEventListener("click", async () => { if (await fn()) again(); });
  press("[data-run]", () => run(() => api("/payroll/run", { method: "POST", body: { month } }), "Worked out"));
  press("[data-lock]", () => run(() => api("/payroll/finalise", { method: "POST", body: { month } }), words().locked));
  press("[data-adj]", () => adjust(month, t.team.filter((p) => p.active !== false)));
  press("[data-send-all]", () => send(month));
  body.querySelectorAll("[data-rm]").forEach((x) => x.addEventListener("click", async () => { if (await run(() => api(`/payroll/adjust/${x.dataset.rm}`, { method: "DELETE" }))) again(); }));
}
