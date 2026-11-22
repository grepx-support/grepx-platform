/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The header's theme button: opens a small menu with the mode (Light / Dark / Auto) and the product's palettes.
// Each swatch is painted by the palette's own CSS (data-palette on the swatch), so colours live only in palettes.css.
import { Component } from "../core/component.js";
import { html, fromHtml } from "../core/dom.js";
import { icon } from "../icons/icons.js";

const MODE_LABELS = [["light", "Light", "sun"], ["dark", "Dark", "moon"], ["system", "Auto", "monitor"]];

function swatch(p, mode, vars) {
  const own = p.id === "brand" ? Object.entries(vars).map(([k, v]) => `--${k}:${v}`).join(";") : "";
  return html`<span class="sw" data-palette="${p.id}" data-theme="${mode}" style="${own}">
    <i style="background:var(--bg)"></i><i style="background:var(--card)"></i><i style="background:var(--primary)"></i><i style="background:var(--accent)"></i></span>`;
}

function menu(theme) {
  const mode = theme.current(), choice = theme.choice(), active = theme.palette();
  return html`<div class="kit-theme-menu" role="dialog" aria-label="Theme">
    <h4>Mode</h4>
    <div class="kit-theme-modes">${MODE_LABELS.map(([id, label, ic]) => html`<button type="button" data-mode="${id}" aria-pressed="${choice === id}">${icon(ic, { size: 14 })}${label}</button>`)}</div>
    <h4>Colours</h4>
    <div class="kit-theme-list">${theme.list.map((p) => html`<button type="button" class="kit-theme-pick" data-palette-pick="${p.id}" aria-pressed="${active === p.id}" title="${p.about}">
      ${swatch(p, mode, theme.vars)}<span><b>${p.label}</b><br><small class="muted">${p.about}</small></span></button>`)}</div></div>`;
}

export class ThemeMenu extends Component {
  /** props: { theme: Theme } */
  render() {
    const dark = this.props.theme.current() === "dark";
    return html`<button type="button" class="kit-iconbtn" aria-haspopup="dialog" aria-expanded="false" aria-label="Theme and colours"
      title="Theme and colours">${icon(dark ? "moon" : "sun")}</button>`;
  }

  mounted() {
    this.el.onclick = () => (this.box ? this.close() : this.open());
    this.onCleanup(this.props.theme.on("change", () => { if (this.box) this.redrawMenu(); this.el.innerHTML = this.build().innerHTML; }));
    this.onCleanup(() => this.close());
  }

  open() {
    this.redrawMenu();
    this.el.setAttribute("aria-expanded", "true");
    const away = (e) => { if (!this.box?.contains(e.target) && !this.el.contains(e.target)) this.close(); };
    const key = (e) => { if (e.key === "Escape") { this.close(); this.el.focus(); } };
    setTimeout(() => document.addEventListener("click", away));
    document.addEventListener("keydown", key);
    this.unlisten = () => { document.removeEventListener("click", away); document.removeEventListener("keydown", key); };
    this.box.querySelector('[aria-pressed="true"]')?.focus();
  }

  redrawMenu() {
    const was = document.activeElement, again = this.box?.contains(was) ? [...this.box.querySelectorAll("button")].indexOf(was) : -1;
    const next = fromHtml(menu(this.props.theme).text);
    this.box ? this.box.replaceWith(next) : document.body.append(next);
    this.box = next;
    const r = this.el.getBoundingClientRect(), w = next.offsetWidth;
    Object.assign(next.style, { top: `${r.bottom + 8}px`, left: `${Math.max(8, Math.min(r.right - w, innerWidth - w - 8))}px` });
    next.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => this.props.theme.set(b.dataset.mode));
    next.querySelectorAll("[data-palette-pick]").forEach((b) => b.onclick = () => this.props.theme.setPalette(b.dataset.palettePick));
    if (again >= 0) next.querySelectorAll("button")[again]?.focus();               // keyboard users keep their place
  }

  close() {
    this.unlisten?.();
    this.unlisten = null;
    this.box?.remove();
    this.box = null;
    this.el?.setAttribute("aria-expanded", "false");
  }
}
