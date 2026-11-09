/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared web shell for every GrepX product: API client (+trace ids), session, router, nav, theme.
// A product = products/<name>.json (brand, colours, modules). Modules live in modules/core (all products)
// and modules/<product>/ (product features). Nothing is copied between products.
export const state = { product: null, session: JSON.parse(localStorage.getItem("session") || "null"), me: null, routes: [] };
const $ = (s) => document.querySelector(s);
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function toast(text) { const d = document.createElement("div"); d.textContent = text; $("#toast").append(d); setTimeout(() => d.remove(), 5000); }

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (state.session) headers.Authorization = `Bearer ${state.session.token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const trace = res.headers.get("X-Trace-Id");
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    const d = data.detail || {};
    if (res.status === 401 && state.session) { logout(); }
    const err = new Error(d.message || "Something went wrong");
    err.reason = d.reason; err.trace = trace;
    throw err;
  }
  return data;
}

export async function run(fn, done) {
  try { const r = await fn(); if (done) toast(done); return r; }
  catch (e) { toast(`${e.message}${e.trace ? `  (trace ${e.trace.slice(0, 12)})` : ""}`); }
}

export function login(session) { state.session = session; localStorage.setItem("session", JSON.stringify(session)); return loadMe(); }
export function logout() { state.session = null; state.me = null; localStorage.removeItem("session"); renderNav(); location.hash = "#/"; }
async function loadMe() { state.me = state.session ? await api("/me").catch(() => null) : null; renderNav(); }

// /me says whether the user is staff (is_staff) and which permissions they hold (perms); "*" = everything.
const staff = () => !!state.me && (state.me.is_staff ?? state.me.role !== (state.product.member_role || "member"));
export const can = (perm) => !!state.me && (state.me.role === "admin" || (state.me.perms || []).includes("*") || (!perm && staff()) || (state.me.perms || []).includes(perm));
const visible = (r) => !r.nav || (r.auth === "staff" ? staff() && can(r.perm) : r.auth === "user" ? !!state.me : r.auth === "admin" ? state.me?.role === "admin" : true);

function renderNav() {
  const here = location.hash.split("?")[0] || "#/";
  $("#nav").innerHTML = state.routes.filter((r) => r.nav && visible(r)).map((r) => `<a href="#${r.path}" class="${here === "#" + r.path ? "on" : ""}">${esc(r.nav)}</a>`).join("");
  $("#who").innerHTML = state.me ? `<span class="muted">${esc(state.me.name || "")}</span> <button class="btn small" id="out">Log out</button>` : `<a class="btn small primary" href="#/login">Log in</a>`;
  $("#out")?.addEventListener("click", logout);
}

async function route() {
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const params = Object.fromEntries(new URLSearchParams(query || ""));
  for (const r of state.routes) {
    const m = path.match(new RegExp("^" + r.path.replace(/:\w+/g, "([^/]+)") + "$"));
    if (!m) continue;
    if (r.auth && !state.me) { location.hash = "#/login"; return; }
    renderNav();
    $("#view").innerHTML = '<p class="muted">Loading…</p>';
    try { await r.render($("#view"), { ...params, args: m.slice(1) }); }
    catch (e) { $("#view").innerHTML = `<div class="card"><h2>Couldn't load this page</h2><p>${esc(e.message)}</p>${e.trace ? `<p class="muted">trace ${esc(e.trace)}</p>` : ""}</div>`; }
    return;
  }
  $("#view").innerHTML = '<div class="card"><h2>Not found</h2></div>';
}

async function boot() {
  state.product = await (await fetch("/product.json")).json();
  const p = state.product;
  document.title = p.name;
  for (const [k, v] of Object.entries(p.theme || {})) document.documentElement.style.setProperty(`--${k}`, v);
  $("#brand").innerHTML = `${esc(p.logo || "")} <b>${esc(p.name)}</b>`;
  for (const name of p.modules) {
    const mod = await import(`/assets/modules/${name}.js`);
    state.routes.push(...mod.routes);
  }
  await loadMe();
  window.addEventListener("hashchange", route);
  route();
}
boot();
