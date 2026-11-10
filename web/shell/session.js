/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Who is signed in and what they may open.
import { api, onUnauthorized } from "./api.js";
import { state } from "./state.js";

const listeners = new Set();
/** Called whenever the signed-in user changes (log in, log out, /me reloaded). */
export const onSessionChange = (fn) => listeners.add(fn);
const changed = () => listeners.forEach((fn) => fn(state.me));

export async function loadMe() {
  state.me = state.session ? await api("/me").catch(() => null) : null;
  changed();
}

export function login(session) {
  state.session = session;
  try { localStorage.setItem("session", JSON.stringify(session)); } catch (e) { /* storage unavailable */ }
  return loadMe();
}

export function logout() {
  state.session = null;
  state.me = null;
  try { localStorage.removeItem("session"); localStorage.removeItem("support.return"); } catch (e) { /* storage unavailable */ }
  changed();
  location.hash = "#/";
}
onUnauthorized(logout);

// /me says whether the user is staff (is_staff) and which permissions they hold (perms); "*" = everything.
const staff = () => !!state.me && (state.me.is_staff ?? state.me.role !== (state.product.member_role || "member"));
export const can = (perm) => !!state.me && (state.me.role === "admin" || (state.me.perms || []).includes("*") || (!perm && staff()) || (state.me.perms || []).includes(perm));

/** A route marked tenant: true works inside one business/organisation (/me tenant); a platform operator has none. */
export const outside = (r) => !!(r.tenant && state.me && !state.me.tenant);
const allowed = (r) => (r.auth === "staff" ? staff() && can(r.perm) : r.auth === "user" ? !!state.me : r.auth === "admin" ? state.me?.role === "admin" : true);
/** A route marked platform: true is for the platform itself (no organisation) - hidden while inside one. */
const insideOnly = (r) => !!(r.platform && state.me?.tenant);
export const visible = (r) => !r.nav || (!outside(r) && !insideOnly(r) && allowed(r));
