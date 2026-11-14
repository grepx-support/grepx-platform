/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Staff & roles, system health (heartbeats) and the trace viewer — every product gets these.
import { api, esc, run, state } from "../../app.js";

export const routes = [
  { path: "/admin/staff", nav: "Staff", icon: "users", group: "Platform", area: "#0ea5e9", auth: "admin", platform: true, render: async function draw(el) {
    const d = await api("/admin/access/staff");
    el.innerHTML = `<h1>Staff & roles</h1><div class="card"><table><tr><th>Name</th><th>Role</th><th>Staff role</th><th>Permissions</th><th></th></tr>
      ${d.staff.map((s) => `<tr><td>${esc(s.name || s.id)}</td><td>${esc(s.role)}</td><td><select data-u="${s.id}"><option value="">—</option>${d.roles.map((r) => `<option value="${r.id}" ${r.id === s.staff_role_id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></td>
      <td class="muted">${esc((s.effective || []).join(", "))}</td>
      <td><button class="btn small" data-off="${s.id}" title="For someone who lost their phone">Two-step off</button></td></tr>`).join("")}</table></div><br>
      <form id="p" class="card row"><div><label>Make someone staff (user id)</label><input name="u" required></div><div><label>Role</label><select name="r">${(state.product.roles || ["member", "staff", "admin"]).map((r) => `<option>${esc(r)}</option>`).join("")}</select></div><button class="btn primary">Save</button></form>`;
    el.querySelectorAll("[data-u]").forEach((s) => s.onchange = () => run(() => api(`/admin/access/users/${s.dataset.u}/staff-role`, { method: "POST", body: { staff_role_id: s.value } }), "Saved"));
    el.querySelectorAll("[data-off]").forEach((b) => b.onclick = () => run(() => api(`/admin/access/users/${b.dataset.off}/two-step-off`, { method: "POST", body: {} }), "Two-step login switched off - they can sign in with the password"));
    el.querySelector("#p").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target); await run(() => api(`/admin/access/users/${f.get("u")}/role`, { method: "POST", body: { role: f.get("r") } }), "Saved"); draw(el); };
  } },
  { path: "/admin/system", nav: "System", icon: "shield", group: "Platform", area: "#64748b", auth: "admin", platform: true, render: async function draw(el, q) {
    const s = await api("/admin/access/system");
    const trace = q.trace ? await api(`/admin/access/traces/${q.trace}`).catch(() => null) : null;
    el.innerHTML = `<h1>System</h1><p class="${s.down.length ? "bad" : "ok"}">${s.down.length ? "Down: " + esc(s.down.join(", ")) : "All reporting services are up"}</p>
      <div class="card"><table><tr><th>Service</th><th>State</th><th>Port</th><th>Handled</th><th>Rejected</th><th>Errors</th><th>Last error</th></tr>
      ${s.services.map((x) => `<tr><td>${esc(x.service)}</td><td class="${x.up ? "ok" : "bad"}">${x.up ? "UP" : "DOWN"}</td><td>${esc(x.port)}</td><td>${esc(x.handled ?? "")}</td><td>${esc(x.rejected ?? "")}</td>
      <td class="${x.errors ? "bad" : ""}">${esc(x.errors ?? "")}</td><td class="muted">${esc(x.last_error || "")}</td></tr>`).join("")}</table></div><br>
      <form id="t" class="card row"><div><label>Follow a request (X-Trace-Id from an error message)</label><input name="t" value="${esc(q.trace || "")}"></div><button class="btn primary">Trace</button></form>
      ${trace ? `<div class="card"><h2 class="${trace.ok ? "ok" : "bad"}">${trace.ok ? "Completed" : "Problem"} · ${trace.events} steps · ${trace.duration_ms} ms</h2>
        <p class="muted">${esc(trace.services.join(" → "))}</p><table><tr><th>#</th><th>Service</th><th>Row</th><th>Status</th><th>Reason / error</th></tr>
        ${trace.steps.map((st) => `<tr class="${st.reason || st.error ? "bad" : ""}"><td>${st.hop}</td><td>${esc(st.service)}</td><td>${esc(st.table)}/${esc(st.key.slice(0, 10))}</td><td>${esc(st.from || "∅")}→${esc(st.to)}</td><td>${esc(st.reason || st.error)}</td></tr>`).join("")}</table>
        ${trace.stuck.map((st) => `<p class="bad">Stuck at ${esc(st.table)} — waiting for ${esc(st.waiting_for)} (is it running?)</p>`).join("")}</div>` : ""}
      <br><div class="card"><h2>Dead letters</h2>${s.dead_letters.map((d) => `<div class="item"><b>${esc(d.service)}</b> ${esc(d.error)} <a href="#/admin/system?trace=${esc(d.trace_id)}">trace</a></div>`).join("") || '<p class="muted">None</p>'}</div>`;
    el.querySelector("#t").onsubmit = (e) => { e.preventDefault(); location.hash = `#/admin/system?trace=${new FormData(e.target).get("t")}`; };
  } },
];
