/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The maths of a square crop, apart from any drawing: where the picture sits in the square for a zoom and a pan.
// The picture always covers the square (no empty corners), whatever the zoom or drag.
export class SquareCrop {
  /** width, height = the picture's pixels; box = the square's side on screen. */
  constructor(width, height, box) {
    Object.assign(this, { width, height, box, zoom: 1, x: 0, y: 0 });
    this.base = box / Math.min(width, height);           // scale at zoom 1: the short side fills the square
    this.centre();
  }

  get scale() { return this.base * this.zoom; }

  centre() {
    this.x = (this.box - this.width * this.scale) / 2;
    this.y = (this.box - this.height * this.scale) / 2;
    return this;
  }

  /** Keep the picture covering the square. */
  clamp() {
    const w = this.width * this.scale, h = this.height * this.scale;
    this.x = Math.min(0, Math.max(this.box - w, this.x));
    this.y = Math.min(0, Math.max(this.box - h, this.y));
    return this;
  }

  pan(dx, dy) { this.x += dx; this.y += dy; return this.clamp(); }

  /** Zoom about the square's centre (1 - 4). */
  setZoom(zoom) {
    const next = Math.min(4, Math.max(1, zoom));
    const cx = (this.box / 2 - this.x) / this.scale, cy = (this.box / 2 - this.y) / this.scale;
    this.zoom = next;
    this.x = this.box / 2 - cx * this.scale;
    this.y = this.box / 2 - cy * this.scale;
    return this.clamp();
  }

  /** The source rectangle (picture pixels) that the square shows: [sx, sy, side]. */
  source() {
    return [(0 - this.x) / this.scale, (0 - this.y) / this.scale, this.box / this.scale];
  }
}
