/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Self-service sign-up of a new business (any business product with signup-service), in the GrepX look (grepx.sg):
//   #/signup          details -> confirm email (link) and phone (code) -> the business is set up -> links + checklist
//   #/signup/email    where the email link lands (?signup=..&token=..)
//   /b/<name>         the business's own address: its public page;  /b/<name>/app: sign in to it
// product.json: "signup": "business" switches it on; "signup_copy": {unit, checklist[]} in the product's words.
import { api, esc, login, state } from "../../app.js";

const KEY = "signup.id";
const keep = { get: () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) { /* private window */ } } };

// /b/<name> and /b/<name>/app are real addresses (the server answers them with this app): open the right page.
const at = location.pathname.match(/^\/b\/([a-z0-9-]{3,30})(\/app)?\/?$/);
if (at && (!location.hash || location.hash === "#/" || location.hash === "#")) {
  history.replaceState(null, "", `${location.pathname}#${at[2] ? "/login" : `/b/${at[1]}`}`);
}

const COUNTRIES = [
  ["India", "INR", "Asia/Kolkata", "+91"], ["Singapore", "SGD", "Asia/Singapore", "+65"], ["Malaysia", "MYR", "Asia/Kuala_Lumpur", "+60"],
  ["United Arab Emirates", "AED", "Asia/Dubai", "+971"], ["Australia", "AUD", "Australia/Sydney", "+61"], ["United Kingdom", "GBP", "Europe/London", "+44"],
  ["United States", "USD", "America/New_York", "+1"], ["Other (US dollars)", "USD", "UTC", "+"],
];
const ICON = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
};

function css() {
  if (document.querySelector("#su-css")) return;
  const s = document.createElement("style");
  s.id = "su-css";
  s.textContent = `
.su{--g1:#D4B483;--g2:#C9A96E;--g3:#B8946A;--gold:linear-gradient(135deg,#D4B483 0%,#C9A96E 50%,#B8946A 100%);--ink:rgba(255,255,255,.92);
 --body:rgba(255,255,255,.78);--mute:rgba(255,255,255,.6);--line:rgba(255,255,255,.1);--surf:rgba(255,255,255,.045);
 min-height:100vh;display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);font-family:Inter,system-ui,sans-serif;color:var(--ink);
 background:radial-gradient(ellipse at 50% 0%,#131313 0%,#0B0B0B 55%,#080808 100%);color-scheme:dark}
.su a{color:var(--g1)} .su a:hover{color:#E8CFA4}
.su-side{background:#080808;border-right:1px solid rgba(255,255,255,.07);padding:48px;display:flex;flex-direction:column;justify-content:space-between;gap:32px}
.su-brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px}
.su-logo{width:40px;height:40px;border-radius:12px;background:var(--gold);color:#0B0B0B;display:flex;align-items:center;justify-content:center;font-weight:800}
.su-h{margin:0;font-size:42px;line-height:1.08;font-weight:800;background:var(--gold);-webkit-background-clip:text;background-clip:text;color:transparent}
.su-steps{display:flex;flex-direction:column;gap:18px;margin-top:24px}
.su-step{display:flex;gap:14px;align-items:center;font-size:16px;color:var(--mute)}
.su-step b{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:1px solid rgba(255,255,255,.18)}
.su-step.now{color:#fff;font-weight:700} .su-step.now b{background:var(--g2);color:#0B0B0B;border-color:transparent}
.su-step.done b{background:#2A2A2A;color:var(--g1);border-color:transparent}
.su-main{padding:48px 24px;display:flex;justify-content:center;align-items:flex-start}
.su-card{width:100%;max-width:560px;background:#141414;border:1px solid var(--line);border-radius:24px;padding:36px;display:flex;flex-direction:column;gap:18px;
 box-sizing:border-box;box-shadow:0 8px 32px rgba(0,0,0,.4)}
.su-card h2{margin:0;font-size:30px;font-weight:800} .su-card p{margin:0;color:var(--body);line-height:1.5}
.su label{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:var(--ink)}
.su input,.su select{height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.14);padding:0 14px;font-size:15px;background:#0F0F0F;color:var(--ink);font-family:inherit}
.su input:focus,.su select:focus{outline:2px solid var(--g2);outline-offset:1px}
.su .su-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.su-addr{display:flex;border:1px solid rgba(255,255,255,.14);border-radius:12px;overflow:hidden}
.su-addr span{background:#1A1A1A;padding:0 12px;display:flex;align-items:center;font-size:13px;color:var(--mute);font-family:monospace;white-space:nowrap}
.su-addr input{border:none;border-radius:0;flex:1;min-width:0;font-family:monospace}
.su-note{font-size:13px;font-weight:500;color:var(--mute)} .su-note.ok{color:#7BD88F} .su-note.bad{color:#FF8A80}
.su-check{flex-direction:row !important;align-items:flex-start;gap:10px !important;font-weight:400 !important;color:var(--body) !important}
.su-check input{width:20px;height:20px;margin:0}
.su-btn{height:52px;border-radius:14px;border:none;background:var(--gold);color:#0B0B0B;font-weight:700;font-size:16px;cursor:pointer;font-family:inherit;
 display:flex;align-items:center;justify-content:center;text-decoration:none}
.su-btn:hover{box-shadow:0 0 60px rgba(201,169,110,.18)} .su-btn[disabled]{opacity:.6;cursor:wait}
.su-link{background:none;border:none;color:var(--g1);font-weight:600;cursor:pointer;font-family:inherit;font-size:14px;padding:8px 0}
.su-ok{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:14px;background:rgba(123,216,143,.1);color:#7BD88F;font-weight:600}
.su-wait{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:14px;background:var(--surf);border:1px solid var(--line);color:var(--body)}
.su-code{height:60px !important;font-size:26px !important;letter-spacing:.4em;text-align:center;font-weight:700;font-family:monospace !important}
.su-out{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid var(--line);border-radius:14px;padding:14px 16px}
.su-out small{display:block;font-size:12px;color:var(--mute);font-weight:600;letter-spacing:.04em}
.su-out code{font-size:14px;color:var(--ink)}
.su-copy{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:transparent;color:var(--ink);font-weight:600;cursor:pointer}
.su-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.su-list li{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:#0F0F0F;color:var(--body)}
.su-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.su-page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif;color:rgba(255,255,255,.92);
 background:radial-gradient(ellipse at 50% 0%,#131313 0%,#0B0B0B 55%,#080808 100%)}
.su-page .su-card{max-width:640px;text-align:center;align-items:center}
@media (max-width:900px){.su{grid-template-columns:minmax(0,1fr)} .su-side{display:none} .su .su-row{grid-template-columns:minmax(0,1fr)} .su-card{padding:24px}}`;
  document.head.append(s);
}

const unit = () => (state.product.signup_copy || {}).unit || "business";
const checklist = () => (state.product.signup_copy || {}).checklist
  || ["Add your logo, address and tax number in Setup", "Add your places (branches, stores)", "Invite your staff", "Add your first products"];
const origin = () => location.origin;
const message = (e) => e.detail || e.message || "Something went wrong - please try again.";

function frame(el, step, body) {
  const labels = ["Your details", "Confirm email & phone", "We set things up", "Start working"];
  el.innerHTML = `<div class="su"><aside class="su-side"><div class="su-brand"><span class="su-logo">${esc((state.product.name || "G")[0])}</span>${esc(state.product.name)}</div>
    <div><h1 class="su-h">Your ${esc(unit())}, online in about two minutes.</h1><div class="su-steps">${labels.map((l, i) =>
      `<div class="su-step ${i + 1 === step ? "now" : i + 1 < step ? "done" : ""}"><b>${i + 1 < step ? ICON.check : i + 1}</b>${esc(l)}</div>`).join("")}</div></div>
    <span class="su-note">Every feature is free during early access.</span></aside>
    <main class="su-main"><div class="su-card" aria-live="polite">${body}</div></main></div>`;
  return el.querySelector(".su-card");
}

function details(el) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pick = Math.max(0, COUNTRIES.findIndex((c) => c[2] === zone));
  const card = frame(el, 1, `<div><h2>Create your ${esc(unit())}</h2><p>Already have one? <a href="#/login">Sign in</a></p></div>
    <form class="su-form" novalidate style="display:flex;flex-direction:column;gap:16px">
      <label>Business name<input name="business_name" required maxlength="80" autocomplete="organization" placeholder="e.g. Galaxy Mobiles"></label>
      <label>Short name for your address<span class="su-addr"><span>${esc(location.host)}/b/</span><input name="slug" required maxlength="30" autocapitalize="off" spellcheck="false" aria-describedby="su-slug"></span>
        <span class="su-note" id="su-slug">Your page and app will be here. It stays the same when we move to our own domain.</span></label>
      <div class="su-row"><label>Your name<input name="owner_name" required maxlength="80" autocomplete="name"></label>
        <label>Country<select name="country">${COUNTRIES.map((c, i) => `<option value="${i}" ${i === pick ? "selected" : ""}>${esc(c[0])}</option>`).join("")}</select></label></div>
      <div class="su-row"><label>Mobile<input name="phone" type="tel" required autocomplete="tel" placeholder="${esc(COUNTRIES[pick][3])} mobile number"></label>
        <label>Email<input name="email" type="email" required autocomplete="email" placeholder="you@example.com"></label></div>
      <label>Password<input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"></label>
      <label class="su-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="su-check"><input type="checkbox" name="accept_terms" required> I agree to the terms of use and the privacy policy.</label>
      <span class="su-note bad" id="su-err" role="alert"></span>
      <button class="su-btn" type="submit">Continue</button></form>`);
  const form = card.querySelector("form"), slug = form.slug, note = card.querySelector("#su-slug"), err = card.querySelector("#su-err");
  let edited = false, timer = 0;
  const suggest = (v) => v.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");
  const look = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!slug.value) return;
      try {
        const r = await api(`/public/signup/check?slug=${encodeURIComponent(slug.value)}`);
        const why = { INVALID_SLUG: "Use 3-30 small letters, digits or hyphens.", RESERVED_SLUG: "That name is kept for the platform.", SLUG_TAKEN: "Taken - try another." };
        note.className = `su-note ${r.available ? "ok" : "bad"}`;
        note.textContent = r.available ? `Available: ${location.host}/b/${r.slug}` : why[r.problem] || "Not available.";
      } catch (e) { /* the check is a hint; the server checks again */ }
    }, 350);
  };
  form.business_name.oninput = () => { if (!edited) { slug.value = suggest(form.business_name.value); look(); } };
  slug.oninput = () => { edited = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); look(); };
  form.country.onchange = () => { form.phone.placeholder = `${COUNTRIES[form.country.value][3]} mobile number`; };
  form.onsubmit = async (e) => {
    e.preventDefault();
    err.textContent = "";
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form)), c = COUNTRIES[f.country];
    let phone = f.phone.trim();
    if (!phone.startsWith("+") && c[3] !== "+") phone = `${c[3]}${phone.replace(/^0+/, "")}`;
    const btn = form.querySelector("button");
    btn.disabled = true;
    try {
      const r = await api("/public/signup", { method: "POST", body: { ...f, phone, currency: c[1], timezone: c[2], accept_terms: !!f.accept_terms } });
      keep.set(r.signup.signup_id);
      verify(el, r.signup);
    } catch (x) { err.textContent = message(x); btn.disabled = false; }
  };
}

let poll = 0;
function verify(el, s) {
  clearInterval(poll);
  if (s.stage === "active") return keep.set(""), ready(el, s);
  const card = frame(el, 2, `<div><h2>Confirm it's you</h2><p>Two quick checks keep fake ${esc(unit())}s out.</p></div>
    ${s.email_ok ? `<div class="su-ok">${ICON.check} Email confirmed</div>`
      : `<div class="su-wait">We emailed a link to <b>${esc(s.email)}</b>. Open it (on any device) to confirm.
         <button type="button" class="su-link" data-again="email">Send again</button></div>`}
    ${s.phone_ok ? `<div class="su-ok">${ICON.check} Mobile confirmed</div>`
      : `<form class="su-code-form" style="display:flex;flex-direction:column;gap:12px"><label>Code sent to ${esc(s.phone)} by SMS / WhatsApp
         <input class="su-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required pattern="[0-9]{6}" autofocus></label>
         <span class="su-note bad" id="su-err" role="alert"></span>
         <button class="su-btn" type="submit">Confirm code</button>
         <button type="button" class="su-link" data-again="phone">Send a new code</button></form>`}
    ${s.email_ok && s.phone_ok ? '<div class="su-wait">Setting up...</div>' : ""}
    <button type="button" class="su-link" data-restart>Start again with different details</button>`);
  const err = card.querySelector("#su-err");
  card.querySelectorAll("[data-again]").forEach((b) => b.onclick = async () => {
    try { await api(`/public/signup/${s.signup_id}/resend`, { method: "POST", body: { what: b.dataset.again } }); b.textContent = "Sent"; b.disabled = true; }
    catch (x) { (err || b).textContent = message(x); }
  });
  card.querySelector("[data-restart]").onclick = () => { clearInterval(poll); keep.set(""); details(el); };
  const form = card.querySelector(".su-code-form");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    form.querySelector("button").disabled = true;
    try { await after(el, await api(`/public/signup/${s.signup_id}/phone`, { method: "POST", body: { code: form.code.value } })); }
    catch (x) { err.textContent = message(x); form.querySelector("button").disabled = false; form.code.select(); }
  };
  if (s.email_ok && s.phone_ok) {                       // both were confirmed but the set-up did not finish (page closed): finish now
    api(`/public/signup/${s.signup_id}/finish`, { method: "POST" }).then((r) => after(el, r)).catch(() => {});
    return;
  }
  poll = setInterval(async () => {                      // the email link may be opened in another tab or on the phone
    if (!document.body.contains(card)) return clearInterval(poll);
    try {
      const now = (await api(`/public/signup/${s.signup_id}`)).signup;
      if (now.stage === "active" || now.email_ok !== s.email_ok || now.phone_ok !== s.phone_ok) verify(el, now);
    } catch (e) { /* keep waiting */ }
  }, 4000);
}

async function after(el, r) {
  if (!r.done) return verify(el, r.signup);
  clearInterval(poll);
  keep.set("");
  frame(el, 3, '<div class="su-wait">Setting things up...</div>');
  if (r.session && r.session.token) await login(r.session);
  ready(el, { ...r.signup, slug: r.slug }, !!(r.session && r.session.token));
}

function ready(el, s, signedIn) {
  const page = `${origin()}/b/${s.slug}`, app = `${page}/app`;
  const card = frame(el, 4, `<div class="su-logo" style="width:56px;height:56px">${ICON.check}</div>
    <div><h2>${esc(s.business_name || "Your business")} is live</h2><p>Save these two links.</p></div>
    <div class="su-out"><div><small>YOUR PUBLIC PAGE (share this)</small><code>${esc(page)}</code></div><button type="button" class="su-copy" data-copy="${esc(page)}">Copy</button></div>
    <div class="su-out"><div><small>YOUR APP (for you and your staff)</small><code>${esc(app)}</code></div><button type="button" class="su-copy" data-copy="${esc(app)}">Copy</button></div>
    <h3 style="margin:6px 0 0;font-size:16px">Your first steps</h3><ul class="su-list">${checklist().map((t) => `<li>${ICON.check} ${esc(t)}</li>`).join("")}</ul>
    <a class="su-btn" href="${signedIn ? "#/" : "#/login"}">${signedIn ? "Open my app" : "Sign in"}</a>`);
  card.querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch (e) { b.textContent = "Select and copy"; }
  });
}

async function signup(el) {
  css();
  const id = keep.get();
  if (id) {
    try { return verify(el, (await api(`/public/signup/${id}`)).signup); } catch (e) { keep.set(""); }
  }
  details(el);
}

async function fromEmail(el, q) {
  css();
  frame(el, 2, '<div class="su-wait">Confirming your email...</div>');
  try {
    const r = await api(`/public/signup/${encodeURIComponent(q.signup || "")}/email`, { method: "POST", body: { token: q.token || "" } });
    keep.set(q.signup);
    await after(el, r);
  } catch (x) {
    const card = frame(el, 2, `<div><h2>Couldn't confirm</h2><p>${esc(message(x))}</p></div><a class="su-btn" href="#/signup">Back to sign-up</a>`);
    card.focus();
  }
}

async function business(el, { args }) {
  css();
  el.innerHTML = '<div class="su-page"><div class="su-card"><p>Loading...</p></div></div>';
  const card = el.querySelector(".su-card");
  try {
    const b = await api(`/public/address/${encodeURIComponent(args[0])}`);
    if (b.moved) history.replaceState(null, "", `/b/${b.slug}#/b/${b.slug}`);
    document.title = b.name;
    card.innerHTML = `<span class="su-logo" style="width:64px;height:64px;font-size:28px">${esc((b.name || "?")[0])}</span>
      <h1 class="su-h" style="font-size:48px">${esc(b.name)}</h1>
      <p>Welcome! Our full page with offers and updates is coming soon.</p>
      <a class="su-btn" style="padding:0 28px" href="/b/${esc(b.slug)}/app#/login">Staff sign in</a>
      <span class="su-note">Runs on ${esc(state.product.name)}</span>`;
  } catch (e) {
    card.innerHTML = `<h2>No business here</h2><p>${esc(message(e))}</p><a class="su-btn" style="padding:0 28px" href="/#/signup">Start your own - free</a>`;
  }
}

/** The platform operator: every sign-up, its stage, its address, and messages that only went to the log (no provider yet). */
async function operatorList(el) {
  const { signups, addresses } = await api("/platform/signups");
  const stage = { pending: "Waiting for checks", verified: "Checked", setting_up: "Setting up", active: "Live", failed: "Failed" };
  el.innerHTML = `<h1>Sign-ups</h1><p class="muted">Businesses that signed up themselves. Until email and SMS / WhatsApp are set up (Integrations),
    the link and the code only go to the log - they are shown here so you can pass them on to a tester.</p>
    <div class="card" style="overflow-x:auto"><table><tr><th>When</th><th>Business</th><th>Address</th><th>Owner</th><th>Email / mobile</th><th>Stage</th><th>Messages in the log</th></tr>
    ${signups.map((s) => `<tr><td class="muted">${esc((s.created_at || "").replace("T", " ").slice(0, 16))}</td><td><b>${esc(s.business_name)}</b></td>
      <td>${s.stage === "active" ? `<a href="/b/${esc(s.slug)}" target="_blank" rel="noopener">/b/${esc(s.slug)}</a>` : `<span class="muted">/b/${esc(s.slug)}</span>`}</td>
      <td>${esc(s.owner_name)}</td><td>${esc(s.email)} ${s.email_ok ? "✓" : ""}<br>${esc(s.phone)} ${s.phone_ok ? "✓" : ""}</td>
      <td class="${s.stage === "failed" ? "bad" : s.stage === "active" ? "ok" : ""}">${esc(stage[s.stage] || s.stage)}${s.reason ? `<br><small>${esc(s.reason)}</small>` : ""}</td>
      <td>${(s.logged || []).map((m) => `<details><summary>${esc(m.channel)} to ${esc(m.to)}</summary><pre style="white-space:pre-wrap;max-width:360px">${esc(m.text)}</pre></details>`).join("") || '<span class="muted">-</span>'}</td></tr>`).join("")
      || '<tr><td colspan="7" class="muted">No sign-ups yet. The sign-up page is <a href="#/signup">/#/signup</a>.</td></tr>'}</table></div>
    <p class="muted small">${Object.keys(addresses).length} businesses have a short-name address.</p>`;
}

export const routes = state.product.signup === "business" ? [
  { path: "/platform/signups", nav: "Sign-ups", icon: "users", group: "Platform", area: "#C9A96E", auth: "admin", platform: true, render: operatorList },
  { path: "/signup", bare: true, render: signup },
  { path: "/signup/email", bare: true, render: fromEmail },
  { path: "/b/:slug", bare: true, render: business },
] : [];
