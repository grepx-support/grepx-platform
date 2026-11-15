/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Leave: requests to approve, the month's calendar (one row per person away, a bar across the days), balances per
// person and type, and asking for leave on someone's behalf.
import { api, run } from "/assets/app.js";
import { empty, html, icon, kpiRow, openDialog, pill } from "/assets/kit/index.js";
import { addDays, frame } from "./common.js";

const COLOR = { annual: "#0891b2", sick: "#e11d48", casual: "#7c3aed", unpaid: "#64748b" };
const monthEnd = (m) => addDays(`${m.slice(0, 7)}-01`, new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate() - 1);

async function ask(types, team) {
  const box = document.createElement("form");
  box.innerHTML = String(html`<div class="row"><label>Person<select name="employee_id">${team.map((p) => html`<option value="${p.employee_id}">${p.name}</option>`)}</select></label>
    <label>Type<select name="type_id">${types.map((t) => html`<option value="${t.type_id}">${t.name}</option>`)}</select></label></div>
    <div class="row"><label>From<input name="first" type="date" required></label><label>To<input name="last" type="date"></label>
    <label class="check"><input type="checkbox" name="half_day"> Half day</label></div><label>Note<input name="note"></label>`);
  if (await openDialog({ title: "Ask for leave", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Ask", value: "ok", primary: true }] }) !== "ok") return null;
  const f = Object.fromEntries(new FormData(box));
  return run(() => api("/leave", { method: "POST", body: { ...f, half_day: !!f.half_day } }), "Leave asked for");
}

export async function leavePage(el, q) {
  const month = q.month || new Date().toISOString().slice(0, 7), first = `${month}-01`, last = monthEnd(month);
  const [v, t] = await Promise.all([api(`/leave?first=${first}&last=${last}&year=${month.slice(0, 4)}`), api("/team")]);
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => addDays(first, i));
  const prev = addDays(first, -1).slice(0, 7), next = addDays(last, 1).slice(0, 7);
  const body = frame(el, "leave", "Leave", `${new Date(`${first}T00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}`,
    html`<a class="btn" href="#/leave?month=${prev}">‹</a><a class="btn" href="#/leave?month=${next}">›</a><button class="btn primary" data-ask>${icon("plus", { size: 15 })} Ask for leave</button>`);
  body.innerHTML = String(html`${kpiRow([{ label: "To approve", value: v.pending.length, icon: "inbox", area: v.pending.length ? "#f59e0b" : "#94a3b8" },
      { label: "Away this month", value: new Set(v.leaves.filter((l) => l.state === "approved").map((l) => l.employee_id)).size, icon: "users", area: "#0891b2" },
      { label: "Days off this month", value: v.leaves.filter((l) => l.state === "approved").reduce((s, l) => s + l.days, 0), icon: "calendar", area: "#7c3aed" }])}
    ${v.pending.length ? html`<section class="card"><h2>${icon("inbox")} To approve</h2>${v.pending.map((l) => html`<div class="lv-req">
      <b>${l.name}</b> ${pill(l.type_name, "info")} ${l.first}${l.last !== l.first ? ` → ${l.last}` : ""} · ${l.days} day${l.days === 1 ? "" : "s"} <span class="muted">${l.note || ""}</span>
      <span class="lv-act"><button class="btn small primary" data-ok="${l.leave_id}">Approve</button><button class="btn small" data-no="${l.leave_id}">Decline</button></span></div>`)}</section>` : ""}
    <section class="card lv-cal">${v.leaves.length ? html`<div class="lv-grid" style="--n:${days.length}"><span></span>${days.map((d) => html`<span class="lv-d ${new Date(`${d}T00:00`).getDay() === 0 ? "off" : ""}">${Number(d.slice(8))}</span>`)}
      ${v.leaves.map((l) => { const a = Math.max(0, days.indexOf(l.first < first ? first : l.first)), b = days.indexOf(l.last > last ? last : l.last);
        return html`<span class="lv-name">${l.name}</span><span class="lv-bar ${l.state}" style="grid-column:${a + 2} / ${b + 3};--c:${COLOR[l.type_id] || "#0891b2"}" title="${l.type_name} ${l.state}">${l.type_name}</span>`; })}</div>`
      : empty({ icon: "calendar", title: "Nobody away this month", text: "" })}</section>
    <section class="card"><h2>Balances ${month.slice(0, 4)}</h2><table class="kit-table"><thead><tr><th>Person</th>${v.types.map((k) => html`<th class="num">${k.name}</th>`)}</tr></thead>
      <tbody>${v.people.map((p) => html`<tr><td>${p.name}</td>${p.types.map((b) => html`<td class="num ${!b.unlimited && b.left <= 0 ? "bad" : ""}">${b.unlimited ? html`<span class="muted">${b.taken} taken</span>`
        : html`<b>${b.left}</b> <span class="muted small">of ${b.allowance}</span>`}</td>`)}</tr>`)}</tbody></table></section>`);
  const again = () => leavePage(el, q);
  el.querySelector("[data-ask]").onclick = async () => { if (await ask(v.types, t.team.filter((p) => p.active !== false))) again(); };
  body.querySelectorAll("[data-ok],[data-no]").forEach((b) => b.onclick = async () => {
    const id = b.dataset.ok || b.dataset.no;
    if (await run(() => api(`/leave/${id}/decide`, { method: "POST", body: { approve: !!b.dataset.ok } }), b.dataset.ok ? "Approved" : "Declined")) again();
  });
}
