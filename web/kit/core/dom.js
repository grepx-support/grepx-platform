/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// DOM helpers used by every kit component: escaping, a safe html`` template, element building, queries.

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);

/** Markup that is already safe (built by html`` or the kit) - inserted as is. */
export class Raw {
  constructor(text) { this.text = String(text); }
  toString() { return this.text; }
}
export const raw = (text) => new Raw(text);

const part = (v) => (v instanceof Raw ? v.text : Array.isArray(v) ? v.map(part).join("") : v === false || v == null ? "" : esc(v));

/** html`<b>${name}</b>` - every value is escaped unless it is Raw (or an array of Raw). Returns Raw. */
export function html(strings, ...values) {
  return raw(strings.reduce((out, s, i) => out + s + (i < values.length ? part(values[i]) : ""), ""));
}

/** Element from markup (first element of it). */
export function fromHtml(markup) {
  const t = document.createElement("template");
  t.innerHTML = String(markup).trim();
  return t.content.firstElementChild;
}

/** h("button", {class: "btn", onclick}, "Save") */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "html") el.innerHTML = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
