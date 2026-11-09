/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Broadcasts, delivery log and automatic-message wording (common template + notification services).
import { api, can, esc, run, state } from "../../app.js";

export const routes = [{ path: "/messages", nav: "Messages", auth: "staff", perm: "view_log", render: async function draw(el) {
  const log = await api("/admin/messages/log");
  const auto = can("*") || true ? await api("/admin/messages/automatic").catch(() => []) : [];
  el.innerHTML = `<h1>Messages</h1>
    <form id="b" class="card"><h2>Broadcast</h2><div class="row"><div><label>Audience</label><select name="audience">
      ${(state.product.audiences || ["member", "staff", "admin"]).map((a) => `<option>${esc(a)}</option>`).join("")}</select></div>
      <div><label>Subject</label><input name="subject"></div></div><label>Message</label><textarea name="text" rows="3" required></textarea>
      <label><input type="checkbox" name="email" checked style="width:auto"> email <input type="checkbox" name="whatsapp" style="width:auto"> WhatsApp <input type="checkbox" name="sms" style="width:auto"> SMS</label>
      <p><button class="btn primary">Send</button></p></form><br>
    ${auto.length ? `<div class="card"><h2>Automatic messages</h2><table><tr><th>Message</th><th>On</th><th>Wording</th><th></th></tr>${auto.map((t) => `<tr><td>${esc(t.label)}</td>
      <td>${t.settings?.enabled === false ? "off" : "on"}</td><td class="muted">${esc((t.settings?.text || t.bodies?.text || "").slice(0, 80))}…</td>
      <td><button class="btn small" data-k="${t.id}" data-on="${t.settings?.enabled === false ? 1 : 0}">${t.settings?.enabled === false ? "Turn on" : "Turn off"}</button></td></tr>`).join("")}</table></div><br>` : ""}
    <div class="card"><h2>Delivery log</h2><table><tr><th>When</th><th>Template</th><th>Channel</th><th>To</th><th>Result</th></tr>
      ${log.map((n) => `<tr><td>${esc((n.occurred_at || "").slice(0, 16).replace("T", " "))}</td><td>${esc(n.template)}</td><td>${esc(n.channel)}</td><td>${esc(n.recipient)}</td>
      <td class="${n.delivery === "FAILED" ? "bad" : ""}">${esc(n.delivery || n.status)}</td></tr>`).join("")}</table></div>`;
  el.querySelector("#b").onsubmit = async (e) => { e.preventDefault(); const f = new FormData(e.target);
    const channels = ["email", "whatsapp", "sms"].filter((c) => f.get(c));
    const r = await run(() => api("/admin/messages/broadcast", { method: "POST", body: { audience: f.get("audience"), subject: f.get("subject"), text: f.get("text"), channels } }));
    if (r) { alert(`Queued for ${r.count} people`); draw(el); } };
  el.querySelectorAll("[data-k]").forEach((b) => b.onclick = async () => { await run(() => api(`/admin/messages/automatic/${b.dataset.k}`, { method: "PUT", body: { enabled: b.dataset.on === "1" } })); draw(el); });
} }];
