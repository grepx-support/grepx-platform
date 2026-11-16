/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// What is under the mouse in a 3D scene: hover (with where the pointer is) and click. A drag to turn the view is not a
// click. A thing's id is its userData.id, or what `idOf(hit)` says (for instanced meshes: hit.instanceId).
import { THREE } from "./stage.js";

export class Picker {
  constructor(stage, targets, { hover, pick, idOf = (h) => h.object.userData.id ?? null }) {
    const el = stage.renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let down = null, over;
    const hit = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, stage.camera);
      const h = ray.intersectObjects(targets, false)[0];
      return h ? idOf(h) : null;
    };
    el.addEventListener("pointermove", (e) => {
      if (down) return;
      const id = hit(e);
      if (id !== over) { over = id; el.style.cursor = id === null ? "grab" : "pointer"; }
      hover(id, e);
    });
    el.addEventListener("pointerleave", () => { over = null; hover(null); });
    el.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener("pointerup", (e) => {
      const still = down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6;
      down = null;
      if (still) pick(hit(e));
    });
  }
}
