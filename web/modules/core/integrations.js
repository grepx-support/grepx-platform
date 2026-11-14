/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Integrations (platform operator): connect email, SMS and WhatsApp. Each channel shows whether it is live or in test
// mode (messages only written to the log), its settings (passwords are never shown back), a sign-in test and a real
// test message. Until a channel is live nothing is lost: every message is still recorded.
import { api, run, toast } from "../../app.js";
import { html, icon, pageHead, pill } from "../../kit/index.js";

const LOOK = { google: ["user", "#4285f4", ""], microsoft: ["building", "#0078d4", ""], company: ["lock", "#7c3aed", ""], email: ["mail", "#2563eb", "an email address"], sms: ["phone", "#f59e0b", "a mobile number, +country code"], whatsapp: ["message", "#16a34a", "a WhatsApp number, +country code"] };

const field = (f) => html`<label class="ig-field"><span>${f.label}${f.secret ? html` ${pill(f.set ? "saved" : "not set", f.set ? "good" : "")}` : ""}</span>
  <input name="${f.name}" ${f.secret ? 'type="password" autocomplete="new-password"' : ""} value="${f.value}" placeholder="${f.secret && f.set ? "•••••••• (leave empty to keep)" : f.hint}"></label>`;

const card = (c) => {
  const [ic, colour, to] = LOOK[c.channel] || ["dot", "#64748b", "an address"];
  return html`<section class="card ig-card ${c.live ? "live" : ""}" style="--c:${colour}" data-ch="${c.channel}">
    <header><span class="ig-icon">${icon(ic, { size: 20 })}</span><h2>${c.label}</h2>${pill(c.live ? "Live" : "Test mode", c.live ? "good" : "warn")}</header>
    <p class="muted small">${c.sign_in ? (c.live ? "The button shows on the login page." : "Off: no button on the login page.")
      : c.live ? "Messages on this channel are really sent." : "Not connected: messages are recorded in the log and the outbox, not sent."}</p>
    <form data-save>${c.fields.map(field)}<div class="row"><button class="btn primary">${icon("check", { size: 15 })} Save</button>
      <button type="button" class="btn" data-test>${icon("bolt", { size: 15 })} Test the connection</button></div></form>
    ${c.sign_in ? "" : html`<form class="ig-send" data-send><input name="to" placeholder="Send a test to ${to}" required><button class="btn">${icon("send", { size: 15 })} Send test</button></form>`}
    <p class="ig-result" aria-live="polite"></p></section>`;
};

async function integrations(el) {
  const list = await api("/admin/integrations");
  el.innerHTML = String(html`${pageHead({ title: "Integrations", icon: "bolt", area: "#7c3aed",
    subtitle: "Connect the channels messages go out on. Keys are stored sealed and never shown again." })}
    <div class="ig-grid">${list.map(card)}</div>`);
  el.querySelectorAll("[data-ch]").forEach((box) => {
    const ch = box.dataset.ch, out = box.querySelector(".ig-result");
    const say = (text, tone) => { out.className = `ig-result ${tone}`; out.textContent = text; };
    box.querySelector("[data-save]").onsubmit = async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(e.target));
      if (await run(() => api("/admin/integrations", { method: "PUT", body: { values } }), "Saved")) integrations(el);
    };
    box.querySelector("[data-test]").onclick = async () => {
      say("Signing in…", "");
      try {
        const r = await api(`/admin/integrations/${ch}/test`, { method: "POST", body: {} });
        say(`${r.ok ? "✓" : "✗"} ${r.message}`, r.ok ? "good" : "bad");
      } catch (err) { say(`✗ ${err.message}`, "bad"); }
    };
    if (box.querySelector("[data-send]")) box.querySelector("[data-send]").onsubmit = async (e) => {
      e.preventDefault();
      say("Sending…", "");
      try {
        const r = await api(`/admin/integrations/${ch}/send-test`, { method: "POST", body: { recipient: e.target.to.value } });
        if (r.delivery === "SENT") { say("✓ Sent - check that it arrived.", "good"); toast("Test message sent"); }
        else if (r.delivery === "LOGGED") say("Recorded only: this channel is not connected yet.", "warn");
        else say(`✗ ${r.error || r.delivery}`, "bad");
      } catch (err) { say(`✗ ${err.message}`, "bad"); }
    };
  });
}

export const routes = [{ path: "/integrations", nav: "Integrations", icon: "bolt", group: "Platform", area: "#7c3aed", auth: "admin", platform: true,
  keywords: "email smtp sms whatsapp twilio meta provider keys channels", render: integrations }];
