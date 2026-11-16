/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Pallet racking and cartons, drawn as instanced meshes (one draw per kind of part, however many bins there are).
// Each bin also gets an invisible box the mouse can hit. Cartons drop onto their shelves when the scene opens.
import { THREE } from "../lib/three/stage.js";
import { BAY, CARTON, fillOf } from "./plan.js";
import { cartonColour } from "./look.js";

class Batch {
  constructor(geometry, material, shadow = true) { Object.assign(this, { geometry, material, shadow, list: [] }); }
  add(x, y, z, turn = 0) {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    o.rotation.y = turn;
    o.updateMatrix();
    this.list.push(o.matrix);
  }
  mesh() {
    const m = new THREE.InstancedMesh(this.geometry, this.material, Math.max(1, this.list.length));
    m.count = this.list.length;
    this.list.forEach((x, i) => m.setMatrixAt(i, x));
    m.castShadow = m.receiveShadow = this.shadow;
    return m;
  }
}

const Box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function frameOf(b, parts) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.up.add(b.x + sx * BAY.w / 2, BAY.h / 2, b.z + sz * (BAY.d / 2 - 0.05));
  BAY.levels.forEach((y) => {
    parts.beam.add(b.x, y, b.z + BAY.d / 2 - 0.03);
    parts.beam.add(b.x, y, b.z - BAY.d / 2 + 0.03);
    parts.deck.add(b.x, y + 0.035, b.z);
  });
  for (const sx of [-1, 1]) for (const y of [0.65, 1.7, 2.75]) parts.brace.add(b.x + sx * BAY.w / 2, y, b.z);
}

export class Racks {
  constructor(plan, mats) {
    const parts = { up: new Batch(Box(0.09, BAY.h, 0.09), mats.upright), beam: new Batch(Box(BAY.w, 0.11, 0.06), mats.beam),
      deck: new Batch(Box(BAY.w - 0.12, 0.035, BAY.d - 0.04), mats.deck), brace: new Batch(Box(0.035, 0.035, BAY.d - 0.1), mats.upright),
      pallet: new Batch(Box(1.3, 0.15, 1.1), mats.pallet), carton: new Batch(Box(CARTON.w, CARTON.h, CARTON.d), mats.carton),
      tape: new Batch(Box(0.12, 0.012, CARTON.d + 0.006), mats.tape) };
    const hitRack = Box(BAY.w, BAY.h, BAY.d), hitFloor = Box(1.4, 2.2, 1.2);
    this.group = new THREE.Group();
    this.bins = new Map();
    plan.bays.forEach((b) => {
      if (b.floor) parts.pallet.add(b.x, 0.075, b.z); else frameOf(b, parts);
      const first = parts.carton.list.length;
      b.cartons.forEach((c) => {
        parts.carton.add(b.x + c.x, c.y, b.z + c.z, c.turn);
        parts.tape.add(b.x + c.x, c.y + CARTON.h / 2 + 0.006, b.z + c.z, c.turn);
      });
      const hit = new THREE.Mesh(b.floor ? hitFloor : hitRack, mats.hit), h = b.floor ? 2.2 : BAY.h;
      hit.position.set(b.x, h / 2, b.z);
      hit.userData.id = b.id;
      this.group.add(hit);
      this.bins.set(b.id, { bay: b, hit, first, count: b.cartons.length, size: b.floor ? [1.4, 2.2, 1.2] : [BAY.w, BAY.h, BAY.d] });
    });
    this.home = parts.carton.list.map((m) => m.clone());
    this.cartons = parts.carton.mesh();
    this.tapes = parts.tape.mesh();
    Object.values(parts).forEach((p) => { if (p !== parts.carton && p !== parts.tape) this.group.add(p.mesh()); });
    this.group.add(this.cartons, this.tapes);
    this.hits = [...this.bins.values()].map((x) => x.hit);
  }

  /** Colour every carton: by expiry, by fill or plain; bins outside `focus` (a Set of ids, or null for all) fade out. */
  paint(mode, focus = null) {
    const grey = new THREE.Color(0x64748b);
    for (const { bay, first, count } of this.bins.values()) {
      const c = cartonColour(bay.tone, mode, fillOf(bay));
      if (focus && !focus.has(bay.id)) c.lerp(grey, 0.8).multiplyScalar(0.55);
      for (let i = first; i < first + count; i++) this.cartons.setColorAt(i, c);
    }
    if (this.cartons.instanceColor) this.cartons.instanceColor.needsUpdate = true;
  }

  /** Cartons fall onto their shelves, a few at a time; runs for about two seconds. */
  dropIn(stage) {
    const m = new THREE.Matrix4(), tape = new THREE.Matrix4(), start = performance.now(), n = this.home.length;
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      let moving = false;
      for (let i = 0; i < n; i++) {
        const k = Math.min(1, Math.max(0, (t - (i % 61) / 61 * 0.9) / 0.6)), lift = (1 - k) ** 2 * 7;
        moving ||= k < 1;
        m.copy(this.home[i]); m.elements[13] += lift;
        this.cartons.setMatrixAt(i, m);
        tape.copy(m); tape.elements[13] += CARTON.h / 2 + 0.006;
        this.tapes.setMatrixAt(i, tape);
      }
      this.cartons.instanceMatrix.needsUpdate = this.tapes.instanceMatrix.needsUpdate = true;
      return moving;
    };
    let on = true;
    stage.onFrame(() => { if (on) on = tick(); });
  }
}
