/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A panel that slides in from the right with the details of one thing, while the page behind stays in view
// (master-detail). One drawer at a time: opening another replaces it. Esc, the close button or a click outside closes it.
import { html, h } from "../core/dom.js";
import { icon } from "../icons/icons.js";

let current = null;

/** openDrawer({ title, body: Node | markup, width = "min(760px, 92vw)", onClose }) -> { el, body, close() } */
export function openDrawer({ title, body, width = "min(760px, 92vw)", onClose = () => {} }) {
  current?.close(true);
  const shade = h("div", { class: "kit-shade" });
  const el = h("aside", { class: "kit-drawer", role: "dialog", "aria-modal": "true", "aria-label": String(title), style: `--w:${width}` });
  el.innerHTML = html`<header><h2>${title}</h2><button type="button" class="kit-iconbtn" data-close aria-label="Close">${icon("x")}</button></header>
    <div class="kit-drawer-body"></div>`.text;
  const slot = el.querySelector(".kit-drawer-body");
  if (body instanceof Node) slot.append(body); else slot.innerHTML = String(body ?? "");
  const key = (e) => { if (e.key === "Escape") close(); };
  function close(replacing = false) {
    window.removeEventListener("keydown", key);
    window.removeEventListener("hashchange", onHash);
    el.classList.add("leaving");
    shade.classList.add("leaving");
    setTimeout(() => { el.remove(); shade.remove(); }, replacing ? 0 : 180);
    if (current?.el === el) current = null;
    onClose();
  }
  const onHash = () => close();
  shade.onclick = () => close();
  el.querySelector("[data-close]").onclick = () => close();
  window.addEventListener("keydown", key);
  window.addEventListener("hashchange", onHash);
  document.body.append(shade, el);
  el.querySelector("[data-close]").focus();
  current = { el, body: slot, close };
  return current;
}
