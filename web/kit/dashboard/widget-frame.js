/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// One dashboard tile: coloured header with icon and title (a link to its page when the widget says `href`), its body,
// and - while editing - grip, resize and hide.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { icon } from "../icons/icons.js";

const WIDTH = { s: "Small", m: "Medium", l: "Large" };

export class WidgetFrame extends Component {
  /** props: { def, size, editing, ctx, onGrow, onHide } */
  render() {
    const { def, size, editing } = this.props;
    return html`<section class="kit-widget size-${size}" data-id="${def.id}" style="--area:${def.area || "var(--accent)"}">
      <header class="kit-whead">
        ${editing ? html`<button type="button" class="kit-grip" aria-label="Move ${def.title} (arrow keys)">${icon("grip", { size: 16 })}</button>` : ""}
        <span class="kit-wicon">${icon(def.icon)}</span>${def.href && !editing
          ? html`<h3><a href="${def.href}" class="kit-wlink">${def.title} ${icon("arrow", { size: 14 })}</a></h3>` : html`<h3>${def.title}</h3>`}
        ${editing ? html`<button type="button" class="kit-iconbtn small" data-grow title="Size: ${WIDTH[size]}" aria-label="Change size of ${def.title}">${icon("resize", { size: 15 })}</button>
          <button type="button" class="kit-iconbtn small" data-hide aria-label="Hide ${def.title}">${icon("eyeoff", { size: 15 })}</button>` : ""}
      </header><div class="kit-wbody"><div class="kit-skeleton"></div></div></section>`;
  }

  mounted() {
    this.el.querySelector("[data-grow]")?.addEventListener("click", () => this.props.onGrow(this.props.def.id));
    this.el.querySelector("[data-hide]")?.addEventListener("click", () => this.props.onHide(this.props.def.id));
    this.fill();
  }

  async fill() {
    const { def, ctx } = this.props;
    const body = this.el.querySelector(".kit-wbody");
    try {
      const data = await def.load(ctx);
      const out = def.render(data, ctx);
      if (out instanceof Node) body.replaceChildren(out);
      else body.innerHTML = String(out ?? "");
      def.mounted?.(body, data, ctx);
    } catch (e) {
      body.innerHTML = html`<p class="kit-werror">${icon("alert", { size: 16 })} Couldn't load: ${e.message || "error"}</p>`.text;
    }
  }
}
