/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// One payslip as the person sees it: earnings, deductions, net, and what the employer pays on top - printable.
import { html, openDialog } from "/assets/kit/index.js";
import { money } from "../lib/format.js";
import { openPdf } from "../lib/pdf.js";

const rows = (b, lines) => lines.map((l) => html`<tr><td>${l.label}</td><td class="num">${money(b, l.amount)}</td></tr>`);

export function payslipBody(b, s) {
  return html`<div class="ps"><header><b>${b.business?.name || ""}</b><span>Payslip ${s.month}</span></header>
    <p><b>${s.name}</b> · ${s.position || ""} · ${s.worked_hours ? `${s.worked_hours} h worked` : ""}${s.unpaid_days ? ` · ${s.unpaid_days} unpaid days` : ""}</p>
    <div class="ps-two"><table class="kit-table"><thead><tr><th>Earnings</th><th></th></tr></thead><tbody>${rows(b, s.earnings)}</tbody>
      <tfoot><tr><th>Gross</th><th class="num">${money(b, s.gross)}</th></tr></tfoot></table>
    <table class="kit-table"><thead><tr><th>Deductions</th><th></th></tr></thead><tbody>${rows(b, s.deductions)}</tbody>
      <tfoot><tr><th>Total</th><th class="num">${money(b, s.deductions.reduce((t, l) => t + l.amount, 0))}</th></tr></tfoot></table></div>
    <p class="ps-net">Net pay <b>${money(b, s.net)}</b></p>
    ${s.employer.length ? html`<p class="muted small">Employer pays on top: ${s.employer.map((l) => `${l.label} ${money(b, l.amount)}`).join(" · ")} - cost ${money(b, s.cost)}</p>` : ""}</div>`;
}

/** send: optional function that sends this payslip (offered once the month is locked). */
export const showPayslip = (b, s, send) => openDialog({ title: `${s.name} - ${s.month}`, wide: true, body: payslipBody(b, s),
  actions: [{ label: "Close", value: "" }, ...(send ? [{ label: "Send…", value: "send" }] : []), { label: "PDF", value: "pdf", primary: true }] })
  .then((v) => (v === "pdf" ? openPdf(`/payroll/payslip?month=${s.month}&employee_id=${s.employee_id}`) : v === "send" && send()));
