/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// On a phone: a bar of big buttons at the bottom of the screen for the jobs done most, plus "More" for the menu.
// The product names them (product.json "mobile_tabs": [{label, icon, href, perm?}]); a person sees only those their role
// allows. Hidden on wider screens (ui.css).
import { html, icon } from "../kit/index.js";
import { allowed } from "./session.js";
import { state } from "./state.js";

export function startTabbar() {
  const bar = document.createElement("nav");
  bar.className = "kit-tabbar";
  bar.setAttribute("aria-label", "Main");
  document.body.append(bar);
  const draw = () => {
    const tabs = (state.product?.mobile_tabs || []).filter((t) => !t.perm || allowed({ auth: "staff", perm: t.perm }));
    bar.hidden = !(state.me && state.me.tenant) || !tabs.length;
    const here = location.hash.split("?")[0] || "#/";
    bar.innerHTML = String(html`${tabs.slice(0, 4).map((t) => html`<a href="${t.href}" class="${here === t.href ? "on" : ""}">${icon(t.icon, { size: 22 })}<span>${t.label}</span></a>`)}
      <button type="button" data-more>${icon("menu", { size: 22 })}<span>More</span></button>`);
    bar.querySelector("[data-more]").onclick = () => document.body.classList.toggle("nav-open");
  };
  window.addEventListener("hashchange", draw);
  return draw;
}
