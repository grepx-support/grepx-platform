/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Ways to sign in besides the password: Google, Microsoft or a company's own sign-in (OpenID Connect, sent back here
// with an ID token), and the second step - the authenticator app's code - when two-step login is on.
import { api, esc, login, run, state } from "../../app.js";

const KEY = "sso.pending", BACK = "sso.result";
const store = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* private window */ } },
  drop: (k) => { try { sessionStorage.removeItem(k); } catch (e) { /* private window */ } } };

// Back from the provider: keep its answer and show the #/sso page instead of the raw "#id_token=..." address.
if (/^#(id_token|error)=/.test(location.hash)) {
  store.set(BACK, location.hash.slice(1));
  history.replaceState(null, "", "#/sso");
}

const payload = (jwt) => { try { return JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch (e) { return {}; } };

export function go(p, remember) {
  const nonce = crypto.randomUUID();
  store.set(KEY, JSON.stringify({ id: p.id, nonce, remember }));
  const q = new URLSearchParams({ client_id: p.client_id, redirect_uri: `${location.origin}/`, response_type: "id_token", response_mode: "fragment",
    scope: "openid email profile", nonce, state: nonce, prompt: "select_account" });
  location.assign(`${p.authorize}?${q}`);
}

export async function buttons(el, form) {
  const { providers } = await api("/auth/providers").catch(() => ({ providers: [] }));
  if (!providers.length) return;
  el.innerHTML = `<div class="kit-or"><span>or</span></div>${providers.map((p, i) =>
    `<button type="button" class="btn kit-sso kit-sso-${esc(p.id)}" data-i="${i}"><b>${esc(p.label[0])}</b> Continue with ${esc(p.label)}</button>`).join("")}`;
  el.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) go(providers[b.dataset.i], !!form.remember?.checked); };
}

/** A login answer: signed in, or ask for the app's code first. */
export async function finish(el, s) {
  if (!s) return;
  if (!s.two_step) { await login(s); location.hash = state.product.home_after_login || "#/"; return; }
  el.innerHTML = `<div class="card kit-narrow"><h1>Enter your code</h1><p class="muted">Open your authenticator app and type the 6-digit code for
    ${esc(state.product.name)}. Lost your phone? Type one of your recovery codes.</p><form id="c"><input name="code" inputmode="numeric" autocomplete="one-time-code"
    autofocus required maxlength="12" class="kit-code"><p><button class="btn primary">Sign in</button> <a href="#/login">Start again</a></p></form></div>`;
  el.querySelector("#c").onsubmit = async (e) => {
    e.preventDefault();
    finish(el, await run(() => api("/auth/login/code", { method: "POST", body: { challenge: s.challenge, code: new FormData(e.target).get("code") } })));
  };
}

export async function back(el) {
  const sent = JSON.parse(store.get(KEY) || "null"), answer = new URLSearchParams(store.get(BACK) || "");
  store.drop(KEY); store.drop(BACK);
  const token = answer.get("id_token") || "";
  const fail = (why) => { el.innerHTML = `<div class="card kit-narrow"><h1>Not signed in</h1><p>${esc(why)}</p><p><a class="btn" href="#/login">Back to log in</a></p></div>`; };
  if (!sent || answer.get("error")) return fail(answer.get("error_description") || answer.get("error") || "The sign-in was not finished.");
  if (answer.get("state") !== sent.nonce || payload(token).nonce !== sent.nonce) return fail("This sign-in did not start here - please try again.");
  el.innerHTML = '<div class="card kit-narrow"><p class="muted">Signing you in...</p></div>';
  const s = await run(() => api("/auth/external", { method: "POST", body: { provider: sent.id, id_token: token, remember: sent.remember } }));
  return s ? finish(el, s) : fail("Your account was not found or the sign-in was refused.");
}
