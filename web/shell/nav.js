/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The sidebar (pinned pages first, then grouped links with icons and area colours; groups fold away), the page title in
// the top bar with its pin star, and the user menu.
import { avatar, html, icon } from "../kit/index.js";
import { pins, folded } from "./pins.js";
import { logout, visible } from "./session.js";
import { state } from "./state.js";

/** A route's colour: a name from product.json "areas" or any CSS colour. */
export const areaOf = (r) => (r?.area && state.product?.areas?.[r.area]) || r?.area || "";

const here = () => (location.hash.split("?")[0] || "#/").slice(1) || "/";

/** The nav route that the current page belongs to (longest matching prefix). */
export function currentRoute() {
  const path = here();
  return state.routes.filter((r) => r.nav && (path === r.path || path.startsWith(r.path + "/") || (r.path === "/" && path === "/")))
    .sort((a, b) => b.path.length - a.path.length)[0];
}

const link = (r, active, n = 0) => html`<a href="#${r.path}" class="${r === active ? "on" : ""}" style="${areaOf(r) ? `--area:${areaOf(r)}` : ""}"
  ${r === active ? 'aria-current="page"' : ""}><span class="ni">${icon(r.icon || "dot")}</span>${r.nav}${n ? html`<kbd>Alt ${n}</kbd>` : ""}</a>`;

function links() {
  const shown = state.routes.filter((x) => x.nav && visible(x)), active = currentRoute();
  const groups = new Map();
  for (const r of shown) {
    const g = r.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const pinned = pins.read().map((p) => shown.find((r) => r.path === p)).filter(Boolean);
  const top = pinned.length ? html`<div class="group pinned">${icon("star", { size: 12 })} Pinned</div>${pinned.map((r, i) => link(r, active, i + 1))}` : "";
  return [top, ...[...groups.entries()].map(([g, rs]) => {
    const shut = g && folded.has(g) && !rs.includes(active);
    return html`${g ? html`<button type="button" class="group" data-fold="${g}" aria-expanded="${String(!shut)}">${g}${icon("chevron", { size: 12 })}</button>` : ""}
      ${shut ? "" : rs.map((r) => link(r, active))}`;
  })];
}

function who() {
  const me = state.me;
  if (!me) return html`<a class="btn small primary" href="#/login">Log in</a>`;
  const role = me.tenant ? (me.business_name || "Team") : me.role === "admin" ? "Platform operator" : me.role;
  return html`<a class="kit-me" href="#/profile" title="My profile">${avatar(me.name || me.email || "?", { photo: me.photo_id, size: 34 })}
    <span><span class="name">${me.name || ""}</span><span class="role">${role}</span></span></a>
    <button type="button" class="kit-iconbtn" id="out" aria-label="Log out" title="Log out">${icon("logout")}</button>`;
}

export function renderNav() {
  const nav = document.querySelector("#nav");
  nav.innerHTML = links().map(String).join("");
  nav.querySelectorAll("[data-fold]").forEach((b) => b.onclick = () => { folded.toggle(b.dataset.fold); renderNav(); });
  document.querySelector("#who").innerHTML = String(who());
  document.querySelector("#out")?.addEventListener("click", logout);
  const r = currentRoute();
  const crumb = document.querySelector("#crumb");
  if (crumb) {
    crumb.style.setProperty("--area", areaOf(r) || "var(--primary)");
    const on = r && pins.has(r.path);
    crumb.innerHTML = r ? String(html`<span class="ni">${icon(r.icon || "dot")}</span>${r.nav}
      <button type="button" class="pin ${on ? "on" : ""}" id="pin" aria-pressed="${String(!!on)}" title="${on ? "Unpin from the menu" : "Pin to the top of the menu"}">${icon("star", { size: 16 })}</button>`) : "";
    crumb.querySelector("#pin")?.addEventListener("click", () => { pins.toggle(r.path); renderNav(); });
  }
  document.body.classList.remove("nav-open");
}
