/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Dialogs on the native <dialog>: confirm() for yes/no questions, openDialog() for a form or any content.
import { h, html, raw } from "../core/dom.js";
import { icon } from "../icons/icons.js";

/** openDialog({ title, body: markup|Element, actions: [{label, value, primary, danger}] }) -> Promise<value | null> */
export function openDialog({ title, body, actions = [{ label: "Close", value: null }] }) {
  return new Promise((resolve) => {
    const dlg = h("dialog", { class: "kit-dialog" });
    dlg.innerHTML = html`<form method="dialog"><header><h2>${title}</h2><button value="" class="kit-iconbtn" aria-label="Close">${icon("x")}</button></header>
      <div class="kit-dbody"></div><footer>${actions.map((a) => html`<button class="btn ${a.primary ? "primary" : ""} ${a.danger ? "danger" : ""}"
        value="${a.value ?? ""}">${a.label}</button>`)}</footer></form>`.text;
    const slot = dlg.querySelector(".kit-dbody");
    if (body instanceof Node) slot.append(body); else slot.innerHTML = String(body ?? "");
    dlg.addEventListener("close", () => { const v = dlg.returnValue; dlg.remove(); resolve(v === "" ? null : v); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector("footer .primary, footer button")?.focus();
  });
}

/** await confirm({title, text, ok: "Cancel order", danger: true}) -> true / false */
export async function confirm({ title, text = "", ok = "OK", cancel = "Back", danger = false }) {
  const v = await openDialog({ title, body: raw(`<p>${html`${text}`.text}</p>`), actions: [{ label: cancel, value: "" }, { label: ok, value: "yes", primary: !danger, danger }] });
  return v === "yes";
}
