/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared web shell for every GrepX product. A product = product.json (brand, colours, areas, modules); modules live in
// modules/core (all products) and the product's own folder. This file only wires the parts together and starts the app;
// each part is its own file under shell/ (state, api, session, nav, router, toast) and the UI kit is under kit/.
import { enableTilt, esc, LocalStore, Theme, ThemeToggle } from "./kit/index.js";
import { api, onUnauthorized, run } from "./shell/api.js";
import { renderNav } from "./shell/nav.js";
import { route } from "./shell/router.js";
import { can, loadMe, login, logout, onSessionChange } from "./shell/session.js";
import { state } from "./shell/state.js";
import { startAssistant } from "./shell/assistant/index.js";
import { startExpand } from "./shell/expand.js";
import { startFinder } from "./shell/finder/index.js";
import { enterSupport, exitSupport, supportBanner } from "./shell/support.js";
import { toast } from "./shell/toast.js";

// The API every module has always imported from "../../app.js".
export { api, can, enterSupport, esc, exitSupport, login, logout, renderNav, run, state, toast };

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
  enableTilt(".kit-tilt, .kit-kpi");
  const open = () => document.body.classList.toggle("nav-open");
  document.querySelector("#menu").onclick = open;
  document.querySelector(".scrim").onclick = open;
}

/** An optional part that fails to start is reported, never allowed to stop the app. */
function safely(what, start) {
  try { start(); } catch (e) { console.error(`${what} did not start`, e); }
}

function moduleBanner(names) {
  const bar = document.createElement("div");
  bar.className = "support-bar kit-loadfail";
  bar.setAttribute("role", "alert");
  bar.textContent = `Some parts of the app could not load (${names.join(", ")}). The rest works - ask your administrator to update the server.`;
  document.querySelector(".main")?.prepend(bar);
}

async function boot() {
  theme.apply();
  state.product = await (await fetch("/product.json")).json();
  brand(state.product);
  frame();
  // All modules download at once (not one after another); routes keep product.json's order. One module that fails to
  // load (an old or missing file on the server) never blanks the app: the rest works and a banner names what failed.
  const tries = await Promise.allSettled(state.product.modules.map((name) => import(`/assets/modules/${name}.js`)));
  const modules = tries.filter((t) => t.status === "fulfilled").map((t) => t.value);
  const failed = state.product.modules.filter((name, i) => tries[i].status === "rejected");
  failed.forEach((name, i) => console.error(`module ${name} did not load`, tries.filter((t) => t.status === "rejected")[i].reason));
  if (failed.length) moduleBanner(failed);
  modules.forEach((mod) => state.routes.push(...(mod.routes || [])));
  safely("search", () => startFinder(modules, store, document.querySelector("#find")));
  safely("chart expand", () => startExpand());
  safely("assistant", () => startAssistant(modules));
  onSessionChange(renderNav);
  onSessionChange(supportBanner);
  onUnauthorized(async () => { if (!(await exitSupport())) logout(); });   // an expired support session goes back, not out
  await loadMe();
  window.addEventListener("hashchange", route);
  route();
}
boot();
