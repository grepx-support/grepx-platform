/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Palette + basket side by side: drag items from the palette into the basket (or tap +). Pages read builder.lines().
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { DragController } from "../dnd/drag-controller.js";
import { Basket } from "./basket.js";
import { ItemPalette } from "./item-palette.js";

export class Builder extends Component {
  /** props: { items, lines, label, title, empty, step, extras (see Basket), scan (barcode button), onChange(lines) } */
  constructor(props) {
    super(props);
    this.palette = new ItemPalette({ items: props.items, title: props.title, scan: props.scan });
    this.basket = new Basket({ lines: props.lines, label: props.label, empty: props.empty, step: props.step, extras: props.extras || [] });
    this.palette.events.on("pick", (item) => this.basket.add(item));
    if (props.onChange) this.basket.events.on("change", props.onChange);
  }

  render() { return html`<div class="kit-builder"><div class="kit-bslot"></div><div class="kit-pslot"></div></div>`; }

  mounted() {
    this.basket.mount(this.el.querySelector(".kit-bslot"));
    this.palette.mount(this.el.querySelector(".kit-pslot"));
    const drag = new DragController(this.el, { handle: ".kit-pchip", target: ".kit-basket", scope: this.el });
    drag.on("drop", (d) => this.basket.add(this.palette.item(d.source.dataset.id)));
    this.onCleanup(() => drag.destroy());
  }

  lines(keepZero = false) { return this.basket.lines(keepZero); }
}
