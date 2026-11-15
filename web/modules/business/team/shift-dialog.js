/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Add or change one shift: times, break, role, place, person (empty = an open shift anyone can take).
import { api, run } from "/assets/app.js";
import { html, openDialog } from "/assets/kit/index.js";
import { cap, words } from "../lib/words.js";

const PRESETS = [["Morning", "07:00", "15:00", 30], ["Day", "10:00", "18:00", 45], ["Evening", "15:00", "23:00", 30], ["Split", "11:00", "15:00", 0]];

export async function shiftDialog(s, people, sites) {
  const box = document.createElement("form");
  box.className = "rs-form";
  box.innerHTML = String(html`<div class="kit-chips">${PRESETS.map(([n, a, b, br]) => html`<button type="button" class="kit-chip" data-p="${a}|${b}|${br}">${n} ${a}-${b}</button>`)}</div>
    <div class="row"><label>Starts<input name="start" type="time" value="${s.start || "09:00"}"></label><label>Ends<input name="end" type="time" value="${s.end || "17:00"}"></label>
      <label>Break (min)<input name="break_min" type="number" min="0" value="${s.break_min ?? 30}"></label></div>
    <div class="row"><label>Person<select name="employee_id"><option value="">Open shift</option>${people.map((p) =>
      html`<option value="${p.employee_id}" ${p.employee_id === s.employee_id ? "selected" : ""}>${p.name}</option>`)}</select></label>
      <label>${cap(words().place)}<select name="site_id">${sites.map((l) => html`<option value="${l.id}" ${l.id === s.site_id ? "selected" : ""}>${l.name}</option>`)}</select></label>
      <label>Role<input name="role" value="${s.role || ""}" placeholder="Tandoor, Cashier..."></label></div>`);
  box.querySelectorAll("[data-p]").forEach((b) => b.onclick = () => { const [a, e, br] = b.dataset.p.split("|"); box.start.value = a; box.end.value = e; box.break_min.value = br; });
  const actions = [{ label: "Cancel", value: "" }, ...(s.shift_id ? [{ label: "Remove", value: "rm", danger: true }] : []), { label: "Save", value: "save", primary: true }];
  const choice = await openDialog({ title: `${s.shift_id ? "Change" : "Add"} a shift - ${s.date}`, body: box, actions });
  if (choice === "rm") return run(() => api(`/roster/shifts/${s.shift_id}`, { method: "DELETE" }), "Shift removed");
  if (choice !== "save") return null;
  const f = Object.fromEntries(new FormData(box));
  return run(() => api("/roster/shifts", { method: "POST", body: { ...s, ...f, break_min: Number(f.break_min || 0) } }), "Shift saved");
}
