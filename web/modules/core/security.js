/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Sign-in & security (every product): two-step login with an authenticator app - switch on (QR code or key, then a
// first code; ten recovery codes shown once), switch off (password and a code). Linked Google / Microsoft sign-ins.
import { api, run, state } from "../../app.js";
import { html, icon, openDialog, pageHead, pill, raw } from "../../kit/index.js";
import qrcode from "../../vendor/qrcode.js";

function qr(text) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
}

async function switchOn(again) {
  const s = await run(() => api("/me/two-step/start", { method: "POST", body: { issuer: state.product.name } }));
  if (!s) return;
  const box = document.createElement("div");
  box.innerHTML = String(html`<ol class="kit-steps"><li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy).</li>
    <li>Scan this code with it - or type the key.</li></ol><div class="kit-qr">${raw(qr(s.link))}</div>
    <p class="muted small">Key: <code class="kit-key">${s.key.match(/.{1,4}/g).join(" ")}</code></p>
    <label>3. Type the 6-digit code the app shows<input name="code" inputmode="numeric" maxlength="6" class="kit-code"></label>`);
  const ok = await openDialog({ title: "Switch on two-step login", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Switch on", value: "on", primary: true }] });
  if (!ok) return;
  const on = await run(() => api("/me/two-step/enable", { method: "POST", body: { code: box.querySelector("[name=code]").value } }), "Two-step login is on");
  if (!on) return;
  await openDialog({ title: "Keep these recovery codes", body: html`<p>Each works once if you lose your phone. Store them somewhere safe - they are not shown again.</p>
    <div class="kit-recovery">${on.recovery_codes.map((c) => html`<code>${c}</code>`)}</div>`, actions: [{ label: "I have saved them", value: "ok", primary: true }] });
  again();
}

async function switchOff(again) {
  const box = document.createElement("div");
  box.innerHTML = '<label>Password<input name="p" type="password"></label><label>Code from the app (or a recovery code)<input name="c" class="kit-code"></label>';
  if (!await openDialog({ title: "Switch off two-step login", body: box, actions: [{ label: "Cancel", value: "" }, { label: "Switch off", value: "off", danger: true }] })) return;
  if (await run(() => api("/me/two-step/disable", { method: "POST", body: { password: box.querySelector("[name=p]").value, code: box.querySelector("[name=c]").value } }), "Two-step login is off")) again();
}

async function security(el) {
  const st = await api("/me/two-step");
  el.innerHTML = String(html`${pageHead({ title: "Sign-in & security", subtitle: "How you sign in, and the second step that keeps your account safe.", icon: "lock" })}
    <div class="grid two"><section class="card"><h2>${icon("lock")} Two-step login ${st.on ? pill("on", "good") : pill("off", "warn")}</h2>
      <p class="muted">${st.on ? `After your password you type a code from your authenticator app. ${st.recovery_left} recovery codes left.`
        : "Add a second step: a 6-digit code from an app on your phone, so a stolen password is not enough."}</p>
      <p>${st.on ? html`<button class="btn" data-off>Switch off</button>` : html`<button class="btn primary" data-on>${icon("lock", { size: 15 })} Switch on</button>`}</p></section>
    <section class="card"><h2>${icon("user")} Sign-in methods</h2><dl class="kit-facts"><dt>Password</dt><dd>${pill("yes", "good")}</dd>
      ${["google", "microsoft", "company"].map((p) => html`<dt>${p === "company" ? "Company login" : p[0].toUpperCase() + p.slice(1)}</dt>
        <dd>${st.linked.includes(p) ? pill("linked", "good") : html`<span class="muted small">links itself the first time you use it</span>`}</dd>`)}</dl></section></div>`);
  const again = () => security(el);
  el.querySelector("[data-on]")?.addEventListener("click", () => switchOn(again));
  el.querySelector("[data-off]")?.addEventListener("click", () => switchOff(again));
}

export const routes = [{ path: "/security", auth: "user", render: security, keywords: "two-step 2fa mfa authenticator security password sign in" }];
