/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Smooth camera moves: fly the camera and the point it looks at to a new place. Grabbing the view stops a flight.
import { THREE } from "./stage.js";

const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

export class Flight {
  constructor(stage) {
    Object.assign(this, { stage, job: null });
    stage.controls.addEventListener("start", () => { this.job = null; });
    stage.onFrame((dt) => this.step(dt));
  }

  to(look, from, seconds = 1.2) {
    const { camera, controls } = this.stage;
    this.job = { k: 0, seconds, t0: controls.target.clone(), p0: camera.position.clone(), t1: new THREE.Vector3(...look), p1: new THREE.Vector3(...from) };
    return new Promise((done) => { this.job.done = done; });
  }

  step(dt) {
    const j = this.job;
    if (!j) return;
    j.k = Math.min(1, j.k + dt / j.seconds);
    const e = ease(j.k);
    this.stage.controls.target.lerpVectors(j.t0, j.t1, e);
    this.stage.camera.position.lerpVectors(j.p0, j.p1, e);
    if (j.k === 1) { this.job = null; j.done(); }
  }
}
