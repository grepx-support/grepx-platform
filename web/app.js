/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared web shell for every GrepX product. A product = product.json (brand, colours, areas, modules); modules live in
// modules/core (all products) and the product's own folder. This file only wires the parts together and starts the app;
// each part is its own file under shell/ (state, api, session, nav, router, toast) and the UI kit is under kit/.
import { esc, LocalStore, Theme, ThemeToggle } from "./kit/index.js";
import { api, run } from "./shell/api.js";
import { renderNav } from "./shell/nav.js";
import { route } from "./shell/router.js";
import { can, loadMe, login, logout, onSessionChange } from "./shell/session.js";
import { state } from "./shell/state.js";
import { toast } from "./shell/toast.js";

// The API every module has always imported from "../../app.js".
export { api, can, esc, login, logout, renderNav, run, state, toast };

export const store = new LocalStore(`grepx.${location.host}`);
export const theme = new Theme(store);

function brand(p) {
  document.title = p.name;
  for (const [k, v] of Object.entries(p.theme || {})) document.documentElement.style.setProperty(`--${k}`, v);
  for (const href of p.styles || []) {                    // a product's own stylesheet(s), e.g. "kitchen/kitchen.css"
    const link = document.createElement("link");
    Object.assign(link, { rel: "stylesheet", href: `/assets/modules/${href}` });
    document.head.append(link);
  }
  document.querySelector("#brand").innerHTML = `<span class="logo">${esc(p.logo || "")}</span><span>${esc(p.name)}<small>${esc(p.tagline || "")}</small></span>`;
}

function frame() {
  new ThemeToggle({ theme }).mount(document.querySelector("#theme"));
  const open = () => document.body.classList.toggle("nav-open");
  document.querySelector("#menu").onclick = open;
  document.querySelector(".scrim").onclick = open;
}

async function boot() {
  theme.apply();
  state.product = await (await fetch("/product.json")).json();
  brand(state.product);
  frame();
  for (const name of state.product.modules) {
    const mod = await import(`/assets/modules/${name}.js`);
    state.routes.push(...mod.routes);
  }
  onSessionChange(renderNav);
  await loadMe();
  window.addEventListener("hashchange", route);
  route();
}
boot();
