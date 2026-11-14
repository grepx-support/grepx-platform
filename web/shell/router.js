/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Hash routes (#/path?query): find the route, check the user may open it, render it into #view.
import { esc, revealPasswords } from "../kit/index.js";
import { allowed, outside, visible } from "./session.js";
import { renderNav } from "./nav.js";
import { state } from "./state.js";

const view = () => document.querySelector("#view");

function match(path) {
  for (const r of state.routes) {
    const m = path.match(new RegExp("^" + r.path.replace(/:\w+/g, "([^/]+)") + "$"));
    if (m) return { r, args: m.slice(1) };
  }
  return null;
}

function outsideMessage() {
  const home = state.routes.find((x) => x.nav && visible(x));
  return `<div class="card"><h2>This page belongs to a business</h2><p>You are signed in as the platform operator,
    who does not belong to any business. Sign in with a business owner's or staff account to use it.</p>
    ${home ? `<p><a class="btn primary" href="#${home.path}">Go to ${esc(home.nav)}</a></p>` : ""}</div>`;
}

export async function route() {
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const params = Object.fromEntries(new URLSearchParams(query || ""));
  const found = match(path);
  renderNav();
  if (!found) { view().innerHTML = '<div class="card"><h2>Not found</h2></div>'; return; }
  const { r, args } = found;
  document.body.classList.toggle("bare", !!r.bare);        // a page without the app frame (e.g. a public landing page)
  if (r.auth && !state.me) {                               // visitors: the product's landing page on its home, else the login
    location.hash = path === "/" && state.product.landing ? state.product.landing : "#/login";
    return;
  }
  if (outside(r)) {
    const home = state.routes.find((x) => x.nav && visible(x));
    if (r.path === "/" && home) { location.hash = `#${home.path}`; return; }   // the operator's home is their first page
    view().innerHTML = outsideMessage();
    return;
  }
  if (state.me && r.auth && !allowed(r)) {                 // typed or bookmarked: say so, rather than fail on the API
    const home = state.routes.find((x) => x.nav && visible(x));
    view().innerHTML = `<div class="card"><h2>No access to this page</h2><p>Your account cannot open this page. Ask the owner if you need it.</p>
      ${home ? `<p><a class="btn primary" href="#${home.path}">Go to ${esc(home.nav)}</a></p>` : ""}</div>`;
    return;
  }
  // Each visit renders into its own element: a slower page from an earlier click can never overwrite this one.
  const page = document.createElement("div");
  page.className = "page";
  page.innerHTML = '<div class="kit-skeleton"></div>';
  view().replaceChildren(page);
  try {
    await r.render(page, { ...params, args });
    revealPasswords(page);                                 // every password box gets "show password"
  } catch (e) {
    page.innerHTML = loadError(e);
    page.querySelector("[data-retry]")?.addEventListener("click", () => route());
  }
}

/** The card shown when a page cannot load: what happened in plain words, try again, and the trace for support. */
function loadError(e) {
  const down = !e.status || e.status >= 500;
  const hint = down ? "A part of the system did not answer. Try again in a moment; if it keeps happening, the server may need its latest update"
    + " (the administrator runs the update and restart)." : e.message;
  return `<div class="card kit-loaderr"><h2>Couldn't load this page</h2><p>${esc(hint)}</p>
    ${down && e.message && e.message !== "Something went wrong" ? `<p class="muted small">${esc(e.message)}</p>` : ""}
    <p><button class="btn primary" data-retry>Try again</button> <a class="btn" href="#/">Home</a></p>
    ${e.trace ? `<p class="muted small">trace ${esc(e.trace)}</p>` : ""}</div>`;
}
