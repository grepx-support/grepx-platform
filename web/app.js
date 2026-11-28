/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared web shell for every GrepX product. A product = product.json (brand, colours, areas, modules); modules live in
// modules/core (all products) and the product's own folder. This file only wires the parts together and starts the app;
// each part is its own file under shell/ (state, api, session, nav, router, toast) and the UI kit is under kit/.
import { enableTilt, esc, LocalStore, Theme, ThemeMenu } from "./kit/index.js";
import { api, onUnauthorized, run } from "./shell/api.js";
import { renderEnv } from "./shell/env.js";
import { setupMini } from "./shell/mini.js";
import { renderNav } from "./shell/nav.js";
import { route } from "./shell/router.js";
import { can, loadMe, login, logout, onSessionChange } from "./shell/session.js";
import { state } from "./shell/state.js";
import { startAssistant } from "./shell/assistant/index.js";
import { startBell } from "./shell/bell.js";
import { startExpand } from "./shell/expand.js";
import { startFinder } from "./shell/finder/index.js";
import { startTabbar } from "./shell/tabbar.js";
import { setupInstall } from "./shell/install.js";
import { enterSupport, exitSupport, supportBanner } from "./shell/support.js";
import { toast } from "./shell/toast.js";

// The API every module has always imported from "../../app.js".
export { api, can, enterSupport, esc, exitSupport, login, logout, renderNav, run, state, toast };

export const store = new LocalStore(`grepx.${location.host}`);
export const theme = new Theme(store);

function brand(p) {
  document.title = p.name;
  theme.configure({ palettes: p.palettes, palette: p.palette, vars: p.theme, mode: p.mode });   // its colours = the "brand" palette
  theme.apply();
  renderEnv(p.environment);                               // the server's environment (GREPX_ENV) as a badge in the top bar
  for (const href of p.styles || []) {                    // a product's own stylesheet(s), e.g. "kitchen/kitchen.css"
    const link = document.createElement("link");
    Object.assign(link, { rel: "stylesheet", href: new URL(`./modules/${href}`, import.meta.url).href });   // same build as this file
    document.head.append(link);
  }
  document.querySelector("#brand").innerHTML = `<span class="logo">${esc(p.logo || "")}</span><span>${esc(p.name)}<small>${esc(p.tagline || "")}</small></span>`;
}

/** The phone's browser bar takes the palette's main colour. */
function themeColour() {
  const c = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c || state.product?.theme?.primary || "#4f46e5");
}

function frame() {
  new ThemeMenu({ theme }).mount(document.querySelector("#theme"));
  theme.on("change", themeColour);
  enableTilt(".kit-tilt, .kit-kpi");
  const open = () => document.body.classList.toggle("nav-open");
  document.querySelector("#menu").onclick = open;
  setupMini(store);                                         // the menu as icons only: more room for the page, remembered
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
  state.product = window.GREPX_PRODUCT || await (await fetch("/product.json")).json();   // the page carries it (one round trip less)
  brand(state.product);
  setupInstall(state.product.name);                   // installable on phones (every feature), offline page
  themeColour();
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
  safely("tab bar", () => onSessionChange(startTabbar()));
  safely("bell", () => onSessionChange(startBell(document.querySelector("#bell"))));
  onSessionChange(renderNav);
  onSessionChange(supportBanner);
  onUnauthorized(async () => { if (!(await exitSupport())) logout(); });   // an expired support session goes back, not out
  await loadMe();
  window.addEventListener("hashchange", route);
  route();
}
boot();
