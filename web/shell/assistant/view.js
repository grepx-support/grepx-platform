/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// How a reply looks in the chat: its text, number tiles, a list of things (each can open a page or ask again),
// links and suggestion chips. Pure markup.
import { html, icon } from "../../kit/index.js";

const tile = (k) => html`<${k.href ? "a" : "div"} class="as-kpi ${k.tone || ""}" ${k.href ? html`href="${k.href}"` : ""}><small>${k.label}</small><b>${k.value}</b></${k.href ? "a" : "div"}>`;

const item = (it) => {
  const inner = html`<span class="as-it"><b>${it.title}</b>${it.sub ? html`<small>${it.sub}</small>` : ""}</span>${it.value != null ? html`<em class="${it.tone || ""}">${it.value}</em>` : ""}`;
  if (it.ask) return html`<button type="button" class="as-row" data-ask="${it.ask}">${inner}</button>`;
  return it.href ? html`<a class="as-row" href="${it.href}">${inner}${icon("arrow", { size: 14 })}</a>` : html`<div class="as-row">${inner}</div>`;
};

export function replyView(r) {
  return html`<div class="as-reply ${r.tone || ""}"><p>${r.text}</p>
    ${r.kpis?.length ? html`<div class="as-kpis">${r.kpis.map(tile)}</div>` : ""}
    ${r.items?.length ? html`<div class="as-items">${r.items.slice(0, 8).map(item)}${r.items.length > 8 ? html`<small class="muted">and ${r.items.length - 8} more</small>` : ""}</div>` : ""}
    ${r.links?.length ? html`<div class="as-links">${r.links.map((l) => html`<a class="as-link" href="${l.href}">${icon("arrow", { size: 13 })} ${l.label}</a>`)}</div>` : ""}
    ${r.chips?.length ? html`<div class="as-chips">${r.chips.map((c) => html`<button type="button" data-ask="${c}">${c}</button>`)}</div>` : ""}
    ${r.cached ? html`<small class="as-cached" title="Answered from the last minute's data">${icon("bolt", { size: 11 })} instant</small>` : ""}</div>`;
}
