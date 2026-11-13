/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Wires the finder: sources from the shell (pages, recent) and from each product module (search, actions),
// the top-bar button, and the keyboard shortcuts.
import { html, icon, openDialog } from "../../kit/index.js";
import { Finder } from "./finder.js";
import { Shortcuts, SHORTCUTS } from "./shortcuts.js";
import { ActionSource, ModuleSource, PageSource, RecentSource } from "./sources.js";

function help() {
  openDialog({ title: "Keyboard shortcuts", body: html`<dl class="kit-facts kit-keys">${SHORTCUTS.map(([keys, what]) =>
    html`<dt>${keys.map((k) => html`<kbd>${k}</kbd>`)}</dt><dd>${what}</dd>`)}</dl>`, actions: [{ label: "Close", value: "" }] });
}

/** modules: the imported product modules (each may export search(query) and actions). */
export function startFinder(modules, store, button) {
  const recent = new RecentSource(store);
  const sources = [recent, new ActionSource(modules.flatMap((m) => m.actions || [])), new PageSource(),
    ...modules.filter((m) => m.search).map((m) => new ModuleSource(m.searchLabel || "Records", m.search))];
  const finder = new Finder(sources, recent);
  new Shortcuts({ find: () => finder.open(), help });
  if (button) {
    button.innerHTML = String(html`<button type="button" class="kit-findbtn">${icon("search", { size: 16 })}<span>Search</span><kbd>Ctrl K</kbd></button>`);
    button.firstElementChild.onclick = () => finder.open();
  }
  return finder;
}
