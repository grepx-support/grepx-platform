/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// R-2: one adapter mounts a React tree into the element the shell gives a route.
// The shell makes a fresh element per visit, renders into it once, and never tells us when it is replaced (a drawer or dialog
// is removed the same way), so a root is unmounted here as soon as its element has left the page.
import { createContext, createElement, useContext } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

const roots = new Map();          // element -> root, for the elements still on the page
let watcher = null;

/** The element the shell gave this route (pages set their colour area on it, as the legacy pages did). */
export const RouteEl = createContext(null);
export const useRouteEl = () => useContext(RouteEl);

function sweep() {
  for (const [el, root] of roots) {
    if (!el.isConnected) { roots.delete(el); root.unmount(); }
  }
  if (!roots.size && watcher) { watcher.disconnect(); watcher = null; }
}

/** Draw `Component` into `el`; drawing again into the same element replaces the earlier tree. Returns the unmount function. */
export function mountRoute(el, Component, props = {}) {
  roots.get(el)?.unmount();
  const root = createRoot(el);
  roots.set(el, root);
  root.render(createElement(RouteEl.Provider, { value: el }, createElement(Component, props)));
  if (!watcher) {
    watcher = new MutationObserver(sweep);
    watcher.observe(document.body, { childList: true, subtree: true });
  }
  return () => { if (roots.get(el) === root) { roots.delete(el); root.unmount(); } };
}

/** Like mountRoute, but the tree is on the page when this returns (printing needs the page drawn before window.print). */
export function mountNow(el, Component, props = {}) {
  roots.get(el)?.unmount();
  const root = createRoot(el);
  roots.set(el, root);
  flushSync(() => root.render(createElement(RouteEl.Provider, { value: el }, createElement(Component, props))));
  if (!watcher) {
    watcher = new MutationObserver(sweep);
    watcher.observe(document.body, { childList: true, subtree: true });
  }
}

/** How many trees are mounted now (F-8: after many visits this is the number of pages on screen, not the number visited). */
export const mounted = () => roots.size;
