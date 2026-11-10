/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Sign with a finger or mouse; toDataURL() gives a small PNG for proof of delivery.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";

export class SignaturePad extends Component {
  /** props: { label } */
  render() {
    return html`<div class="kit-sign"><canvas width="560" height="180" aria-label="${this.props.label || "Signature"}"></canvas>
      <button type="button" class="btn small" data-clear>Clear</button></div>`;
  }

  mounted() {
    const canvas = this.el.querySelector("canvas");
    const pen = canvas.getContext("2d");
    pen.lineWidth = 2.5; pen.lineCap = "round"; pen.strokeStyle = "#111827";
    this.empty = true;
    let drawing = false;
    const at = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
    canvas.onpointerdown = (e) => { drawing = true; canvas.setPointerCapture(e.pointerId); pen.beginPath(); pen.moveTo(...at(e)); };
    canvas.onpointermove = (e) => { if (!drawing) return; pen.lineTo(...at(e)); pen.stroke(); this.empty = false; };
    canvas.onpointerup = () => { drawing = false; };
    this.el.querySelector("[data-clear]").onclick = () => { pen.clearRect(0, 0, canvas.width, canvas.height); this.empty = true; };
  }

  /** "" when nothing was drawn. */
  toDataURL() { return this.empty ? "" : this.el.querySelector("canvas").toDataURL("image/png"); }
}
