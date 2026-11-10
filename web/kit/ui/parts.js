/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Small building blocks pages use everywhere: page header, tabs, empty state, progress, steps, pills.
import { html } from "../core/dom.js";
import { icon } from "../icons/icons.js";

/** Coloured page header with icon, title, subtitle and actions (markup). */
export const pageHead = ({ title, subtitle = "", icon: name = "dot", area = "", actions = "" }) =>
  html`<header class="kit-phead" style="${area ? `--area:${area}` : ""}"><span class="kit-picon">${icon(name, { size: 26 })}</span>
    <div><h1>${title}</h1>${subtitle ? html`<p>${subtitle}</p>` : ""}</div><div class="kit-pactions">${actions}</div></header>`;

/** Tabs as links: tabs([{id, label, icon, href}], current) */
export const tabs = (list, current) => html`<nav class="kit-tabs" aria-label="Sections">${list.map((t) =>
  html`<a href="${t.href}" class="${t.id === current ? "on" : ""}" ${t.id === current ? 'aria-current="page"' : ""}>${t.icon ? icon(t.icon, { size: 16 }) : ""}${t.label}</a>`)}</nav>`;

export const empty = ({ icon: name = "sparkle", title, text = "", action = "" }) =>
  html`<div class="kit-empty">${icon(name, { size: 40 })}<h3>${title}</h3>${text ? html`<p>${text}</p>` : ""}${action}</div>`;

/** progress(value, max, {label}) - a bar that turns green at 100%. */
export function progress(value, max, { label = "" } = {}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return html`<div class="kit-progress ${pct >= 100 ? "done" : ""}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
    aria-label="${label}"><i style="width:${pct}%"></i><span>${pct}%</span></div>`;
}

/** steps(["Count", "Sales", "Issues", "Check"], 1) */
export const steps = (names, at) => html`<ol class="kit-steps">${names.map((n, i) =>
  html`<li class="${i < at ? "done" : i === at ? "on" : ""}"><span>${i < at ? icon("check", { size: 14 }) : i + 1}</span>${n}</li>`)}</ol>`;

/** pill("sent", "warn") */
export const pill = (text, tone = "") => html`<span class="kit-pill ${tone}">${text}</span>`;

export const avatar = (name = "") => html`<span class="kit-avatar" aria-hidden="true">${name.split(/\s+/).map((p) => p[0] || "").join("").slice(0, 2).toUpperCase()}</span>`;
