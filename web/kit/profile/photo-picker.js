/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Choose a photo (drop, browse or camera), drag and zoom it inside a circle, get a 512 x 512 JPEG back.
// The crop maths is SquareCrop; this class only draws and listens.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { icon } from "../icons/icons.js";
import { SquareCrop } from "./crop.js";

const BOX = 280, OUT = 512;

export class PhotoPicker extends Component {
  /** props: { current: url of the photo now, or "" } */
  render() {
    return html`<div class="kit-photo">
      <div class="kit-photostage" tabindex="0" aria-label="Photo - drag to move, scroll to zoom">
        <canvas width="${BOX * 2}" height="${BOX * 2}"></canvas>
        <div class="kit-photodrop">${icon("camera", { size: 30 })}<b>Drop a photo here</b><span>or choose one below</span></div>
      </div>
      <label class="kit-photozoom">${icon("search", { size: 15 })}<input type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom" disabled></label>
      <div class="row"><label class="btn">${icon("upload", { size: 16 })} Choose photo<input type="file" accept="image/*" hidden></label>
        <label class="btn">${icon("camera", { size: 16 })} Take photo<input type="file" accept="image/*" capture="user" hidden></label></div></div>`;
  }

  mounted() {
    this.canvas = this.el.querySelector("canvas");
    this.pen = this.canvas.getContext("2d");
    this.zoom = this.el.querySelector("input[type=range]");
    this.el.querySelectorAll("input[type=file]").forEach((i) => i.onchange = () => i.files[0] && this.load(i.files[0]));
    this.wireDrop(this.el.querySelector(".kit-photostage"));
    this.wireDrag();
    this.zoom.oninput = () => { this.crop?.setZoom(Number(this.zoom.value)); this.draw(); };
    if (this.props.current) this.loadUrl(this.props.current, false);
  }

  wireDrop(stage) {
    stage.ondragover = (e) => { e.preventDefault(); stage.classList.add("over"); };
    stage.ondragleave = () => stage.classList.remove("over");
    stage.ondrop = (e) => { e.preventDefault(); stage.classList.remove("over"); const f = e.dataTransfer.files[0]; if (f) this.load(f); };
  }

  wireDrag() {
    let last = null;
    const c = this.canvas;
    c.onpointerdown = (e) => { if (!this.crop) return; last = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); };
    c.onpointermove = (e) => {
      if (!last) return;
      const k = BOX / c.getBoundingClientRect().width;
      this.crop.pan((e.clientX - last[0]) * k, (e.clientY - last[1]) * k);
      last = [e.clientX, e.clientY];
      this.draw();
    };
    c.onpointerup = () => { last = null; };
    c.onwheel = (e) => { if (!this.crop) return; e.preventDefault(); this.zoom.value = this.crop.zoom - e.deltaY / 500; this.zoom.oninput(); };
  }

  load(file) {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    this.loadUrl(url, true).finally(() => URL.revokeObjectURL(url));
  }

  loadUrl(url, chosen) {
    return new Promise((done) => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        this.chosen = chosen;
        this.crop = new SquareCrop(img.naturalWidth, img.naturalHeight, BOX);
        this.zoom.disabled = false;
        this.zoom.value = 1;
        this.el.classList.add("has");
        this.draw();
        done();
      };
      img.onerror = done;
      img.src = url;
    });
  }

  draw() {
    const { pen, canvas, img, crop } = this;
    pen.clearRect(0, 0, canvas.width, canvas.height);
    if (!img) return;
    const [sx, sy, side] = crop.source();
    pen.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
  }

  /** The cropped picture as a JPEG data URL, or "" when nothing new was chosen. */
  toDataURL() {
    if (!this.img || !this.chosen) return "";
    const out = document.createElement("canvas");
    out.width = out.height = OUT;
    const [sx, sy, side] = this.crop.source();
    out.getContext("2d").drawImage(this.img, sx, sy, side, side, 0, 0, OUT, OUT);
    return out.toDataURL("image/jpeg", 0.9);
  }
}
