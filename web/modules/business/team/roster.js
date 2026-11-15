/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Roster: a week at one place (or all), people down the side, days across. Click a day to add a shift, drag a shift
// to another day or person to move it, copy last week, publish. Hours, cost and the 48-hour limit per person.
import { api, run } from "/assets/app.js";
import { html, icon, kpiRow } from "/assets/kit/index.js";
import { biz } from "../lib/business.js";
import { money } from "../lib/format.js";
import { addDays, frame, hours, monday } from "./common.js";
import { shiftDialog } from "./shift-dialog.js";
import { words } from "../lib/words.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function chip(s, b) {
  const site = b.locations.find((l) => l.id === s.site_id);
  return html`<div class="rs-shift ${s.published ? "" : "draft"}" draggable="true" data-shift="${s.shift_id}" title="${site?.name || ""}">
    <b>${s.start}-${s.end}</b><span>${s.role || site?.name || ""}</span></div>`;
}

export async function rosterPage(el, q) {
  const b = await biz();
  const week = monday(q.week || new Date().toISOString().slice(0, 10)), site = q.site || "";
  const [w, t] = await Promise.all([api(`/roster?week=${week}&site_id=${site}`), api(`/team?site_id=${site}`)]);
  const people = t.team.filter((p) => p.active !== false), days = DAYS.map((_, i) => addDays(week, i));
  const sum = Object.fromEntries(w.summary.people.map((p) => [p.employee_id, p]));
  const link = (o) => `#/roster?${new URLSearchParams({ week, ...(site ? { site } : {}), ...o })}`;
  const body = frame(el, "roster", "Roster", `Week of ${week}${site ? ` · ${b.locations.find((l) => l.id === site)?.name}` : ` · all ${words().places}`}`,
    html`<a class="btn" href="${link({ week: addDays(week, -7) })}">‹</a><a class="btn" href="${link({ week: addDays(week, 7) })}">›</a>
      <button class="btn" data-copy>${icon("copy", { size: 15 })} Copy last week</button><button class="btn primary" data-pub>${icon("send", { size: 15 })} Publish</button>`);
  const rows = [...people.map((p) => ({ id: p.employee_id, name: p.name, sub: p.position })), { id: "", name: "Open shifts", sub: "anyone can take" }];
  body.innerHTML = String(html`${kpiRow([{ label: "Rostered", value: hours(w.summary.minutes), icon: "clock", area: "#0891b2" },
      { label: "Labour cost", value: money(b, w.summary.cost), icon: "coin", area: "#7c3aed" },
      { label: "Open shifts", value: w.summary.open_shifts, icon: "alert", area: w.summary.open_shifts ? "#f59e0b" : "#94a3b8" },
      { label: "Drafts", value: w.shifts.filter((s) => !s.published).length, icon: "edit", area: "#64748b" }])}
    <div class="kit-chips"><a class="kit-chip ${site ? "" : "on"}" href="#/roster?week=${week}">All ${words().places}</a>${b.locations.map((l) =>
      html`<a class="kit-chip ${site === l.id ? "on" : ""}" href="#/roster?week=${week}&site=${l.id}">${l.name}</a>`)}</div>
    <section class="card rs-wrap"><table class="rs-grid"><thead><tr><th>Person</th>${days.map((d, i) => html`<th>${DAYS[i]} <span class="muted">${d.slice(8)}</span></th>`)}<th>Week</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr><th><b>${r.name}</b><span class="muted small">${r.sub || ""}</span></th>${days.map((d) => html`<td data-cell="${r.id}|${d}">${w.leaves.filter((l) => l.employee_id === r.id && l.first <= d && d <= l.last).map((l) =>
          html`<div class="rs-leave ${l.state}">${l.type_name}</div>`)}${w.shifts
        .filter((s) => (s.employee_id || "") === r.id && s.date === d).map((s) => chip(s, b))}</td>`)}
        <td class="${sum[r.id]?.over_limit ? "bad" : ""}">${sum[r.id] ? html`<b>${hours(sum[r.id].minutes)}</b><span class="muted small">${money(b, sum[r.id].cost)}</span>` : ""}</td></tr>`)}</tbody></table></section>`);
  const again = () => rosterPage(el, q);
  const byId = Object.fromEntries(w.shifts.map((s) => [s.shift_id, s]));
  const sites = site ? b.locations.filter((l) => l.id === site).concat(b.locations.filter((l) => l.id !== site)) : b.locations;
  body.querySelector(".rs-grid").addEventListener("click", async (e) => {
    const shift = byId[e.target.closest("[data-shift]")?.dataset.shift];
    const cell = e.target.closest("[data-cell]")?.dataset.cell;
    if (!shift && !cell) return;
    const [emp, date] = (cell || "|").split("|");
    if (await shiftDialog(shift || { employee_id: emp, date, site_id: site || sites[0]?.id }, people, sites)) again();
  });
  body.querySelectorAll("[data-shift]").forEach((c) => c.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", c.dataset.shift); c.classList.add("dragging"); }));
  body.querySelectorAll("[data-cell]").forEach((td) => {
    td.addEventListener("dragover", (e) => { e.preventDefault(); td.classList.add("over"); });
    td.addEventListener("dragleave", () => td.classList.remove("over"));
    td.addEventListener("drop", async (e) => {
      e.preventDefault(); td.classList.remove("over");
      const s = byId[e.dataTransfer.getData("text/plain")], [emp, date] = td.dataset.cell.split("|");
      if (s && await run(() => api("/roster/shifts", { method: "POST", body: { ...s, employee_id: emp, date } }), "Shift moved")) again();
    });
  });
  el.querySelector("[data-copy]").onclick = async () => {
    const targets = site ? [site] : b.locations.map((l) => l.id);
    for (const s of targets) await run(() => api("/roster/copy", { method: "POST", body: { site_id: s, from_week: addDays(week, -7), to_week: week } }));
    again();
  };
  el.querySelector("[data-pub]").onclick = async () => {
    const targets = site ? [site] : b.locations.map((l) => l.id);
    for (const s of targets) await run(() => api("/roster/publish", { method: "POST", body: { site_id: s, week } }));
    again();
  };
}
