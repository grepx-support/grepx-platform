/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Login, forgot and reset password — identical for every product (common auth-service).
import { api, esc, login, run, state } from "../../app.js";

export const routes = [
  { path: "/login", render: (el) => {
    el.innerHTML = `<div class="card" style="max-width:420px;margin:auto"><h1>Log in</h1><p class="muted">One login for ${esc(state.product.name)} — you'll see what's meant for you.</p>
      <form id="f"><label>Email</label><input name="email" type="email" required><label>Password</label><input name="password" type="password" required>
      <label><input type="checkbox" name="remember" style="width:auto"> Keep me signed in for 7 days</label>
      <p><button class="btn primary">Log in</button> <a href="#/forgot">Forgot password?</a></p></form>
      ${state.product.signup === false ? "" : '<p class="muted">New here? <a href="#/register">Create an account</a></p>'}</div>`;
    el.querySelector("#f").onsubmit = async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      const s = await run(() => api("/auth/login", { method: "POST", body: { email: f.get("email"), password: f.get("password"), remember: !!f.get("remember") } }));
      if (s) { await login(s); location.hash = state.product.home_after_login || "#/"; }
    };
  } },
  { path: "/forgot", render: (el) => {
    el.innerHTML = `<div class="card" style="max-width:420px;margin:auto"><h1>Reset your password</h1><form id="f"><label>Email</label><input name="email" type="email" required><p><button class="btn primary">Send reset link</button></p></form></div>`;
    el.querySelector("#f").onsubmit = (e) => { e.preventDefault(); run(() => api("/auth/forgot", { method: "POST", body: { email: new FormData(e.target).get("email") } }), "If that email is registered, a link is on its way."); };
  } },
  { path: "/reset/:token", render: (el, { args }) => {
    el.innerHTML = `<div class="card" style="max-width:420px;margin:auto"><h1>New password</h1><form id="f"><label>New password (8+)</label><input name="p" type="password" minlength="8" required><p><button class="btn primary">Save</button></p></form></div>`;
    el.querySelector("#f").onsubmit = async (e) => { e.preventDefault(); if (await run(() => api("/auth/reset", { method: "POST", body: { token: args[0], password: new FormData(e.target).get("p") } }), "Password saved — log in.")) location.hash = "#/login"; };
  } },
];
