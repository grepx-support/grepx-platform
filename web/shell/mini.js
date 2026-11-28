/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The main menu shrunk to its icons (names on hover): the page gets the width. Remembered per browser; index.html applies
// it before the first paint so the page does not jump.
const ROOT = () => document.documentElement;

/** Applies a choice to the page and to the button. */
export function applyMini(on, root = ROOT(), button = document.querySelector("#mini")) {
  root.classList.toggle("nav-mini", Boolean(on));
  if (button) {
    button.setAttribute("aria-pressed", String(Boolean(on)));
    button.setAttribute("aria-label", on ? "Show the menu with names" : "Collapse the menu to icons");
  }
}

export function setupMini(store, button = document.querySelector("#mini")) {
  applyMini(store.get("nav_mini", false), ROOT(), button);
  if (button) button.onclick = () => { const on = !ROOT().classList.contains("nav-mini"); store.set("nav_mini", on); applyMini(on, ROOT(), button); };
}
