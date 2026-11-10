/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The sidebar (grouped links with icons and area colours), the page title in the top bar, and the user menu.
import { avatar, html, icon } from "../kit/index.js";
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

function links() {
  const groups = new Map();
  for (const r of state.routes.filter((x) => x.nav && visible(x))) {
    const g = r.group || "";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const active = currentRoute();
  return [...groups.entries()].map(([g, rs]) => html`${g ? html`<div class="group">${g}</div>` : ""}${rs.map((r) =>
    html`<a href="#${r.path}" class="${r === active ? "on" : ""}" style="${areaOf(r) ? `--area:${areaOf(r)}` : ""}" ${r === active ? 'aria-current="page"' : ""}>
      <span class="ni">${icon(r.icon || "dot")}</span>${r.nav}</a>`)}`);
}

function who() {
  const me = state.me;
  if (!me) return html`<a class="btn small primary" href="#/login">Log in</a>`;
  const role = me.tenant ? (me.business_name || "Team") : me.role === "admin" ? "Platform operator" : me.role;
  return html`${avatar(me.name || me.email || "?")}<span><span class="name">${me.name || ""}</span><span class="role">${role}</span></span>
    <button type="button" class="kit-iconbtn" id="out" aria-label="Log out" title="Log out">${icon("logout")}</button>`;
}

export function renderNav() {
  document.querySelector("#nav").innerHTML = links().map(String).join("");
  document.querySelector("#who").innerHTML = String(who());
  document.querySelector("#out")?.addEventListener("click", logout);
  const r = currentRoute();
  const crumb = document.querySelector("#crumb");
  if (crumb) {
    crumb.style.setProperty("--area", areaOf(r) || "var(--primary)");
    crumb.innerHTML = r ? String(html`<span class="ni">${icon(r.icon || "dot")}</span>${r.nav}`) : "";
  }
  document.body.classList.remove("nav-open");
}
