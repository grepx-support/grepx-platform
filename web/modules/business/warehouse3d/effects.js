/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Things that move to draw the eye: the outline + light column + floor ring of the chosen bin, a thinner outline under
// the mouse, and pulsing beacons over bins with expired or nearly expired stock.
import { THREE } from "../lib/three/stage.js";
import { TONE } from "./look.js";

function outline(color, opacity) {
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthTest: false }));
  box.renderOrder = 10;
  box.visible = false;
  return box;
}

function place(obj, entry, grow = 0.08) {
  const [w, h, d] = entry.size, { x, z } = entry.bay;
  obj.scale.set(w + grow, h + grow, d + grow);
  obj.position.set(x, h / 2, z);
  obj.visible = true;
}

export class Highlights {
  constructor(stage, mats) {
    this.group = new THREE.Group();
    this.hover = outline(0xffffff, 0.55);
    this.chosen = outline(0x22d3ee, 1);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48), mats.glow(0x22d3ee));
    this.ring.rotation.x = -Math.PI / 2;
    this.column = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 9, 32, 1, true), new THREE.MeshBasicMaterial({
      color: 0x22d3ee, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.ring.visible = this.column.visible = false;
    this.group.add(this.hover, this.chosen, this.ring, this.column);
    stage.onFrame((dt, t) => {
      const p = 1 + Math.sin(t * 4) * 0.08;
      this.ring.scale.set(p * this.spread, p * this.spread, 1);
      this.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.3;
      this.column.material.opacity = 0.06 + Math.sin(t * 2) * 0.025;
    });
    this.spread = 1;
  }

  show(which, entry) {
    const box = which === "hover" ? this.hover : this.chosen;
    if (!entry) { box.visible = false; if (which === "chosen") this.ring.visible = this.column.visible = false; return; }
    place(box, entry);
    if (which !== "chosen") return;
    const { x, z } = entry.bay, [w, , d] = entry.size;
    this.spread = Math.max(w, d) / 1.8;
    this.ring.position.set(x, 0.02, z);
    this.column.position.set(x, 4.5, z);
    this.column.scale.set(this.spread, 1, this.spread);
    this.ring.visible = this.column.visible = true;
  }
}

/** A glowing ball bobbing over each bin with expired (red) or soon-expiring (amber) stock. */
export function beacons(stage, racks, mats) {
  const group = new THREE.Group(), balls = [];
  const geo = new THREE.SphereGeometry(0.16, 20, 14), halo = new THREE.SphereGeometry(0.34, 20, 14);
  for (const entry of racks.bins.values()) {
    const tone = entry.bay.tone;
    if (tone !== "bad" && tone !== "warn") continue;
    const ball = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: TONE[tone] }));
    const glow = new THREE.Mesh(halo, mats.glow(TONE[tone]));
    ball.add(glow);
    ball.position.set(entry.bay.x, entry.size[1] + 0.55, entry.bay.z);
    ball.userData = { y: ball.position.y, phase: balls.length * 0.7, glow };
    balls.push(ball);
    group.add(ball);
  }
  stage.onFrame((dt, t) => balls.forEach((b) => {
    const s = Math.sin(t * 3 + b.userData.phase);
    b.position.y = b.userData.y + s * 0.12;
    b.userData.glow.material.opacity = 0.35 + (s + 1) * 0.2;
    b.userData.glow.scale.setScalar(1 + (s + 1) * 0.15);
  }));
  return group;
}
