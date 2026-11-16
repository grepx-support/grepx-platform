/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A pick list's walk drawn on the floor: a glowing tube with stripes flowing the way to walk, a numbered tag over each
// stop, and a picker (a bright ball) walking the route on a loop.
import { THREE } from "../lib/three/stage.js";
import { tag } from "../lib/three/labels.js";

function stripes() {
  const cv = Object.assign(document.createElement("canvas"), { width: 64, height: 8 }), g = cv.getContext("2d");
  g.fillStyle = "#0e7490"; g.fillRect(0, 0, 64, 8);
  g.fillStyle = "#67e8f9"; g.fillRect(0, 0, 26, 8);
  const t = new THREE.CanvasTexture(cv);
  Object.assign(t, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, colorSpace: THREE.SRGBColorSpace });
  return t;
}

export class Route {
  constructor(stage, route, tagHeight) {
    this.group = new THREE.Group();
    const path = new THREE.CurvePath(), pts = route.points.map((p) => new THREE.Vector3(p.x, 0.09, p.z));
    for (let i = 1; i < pts.length; i++) path.add(new THREE.LineCurve3(pts[i - 1], pts[i]));
    if (!path.curves.length) return;
    const length = path.getLength(), map = stripes();
    map.repeat.set(length / 0.7, 1);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, Math.max(64, Math.round(length * 6)), 0.07, 8, false),
      new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.95, depthWrite: false }));
    const glow = new THREE.Mesh(tube.geometry, new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1, 1, 1);
    const walker = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    walker.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.group.add(tube, glow, walker);
    route.stops.forEach(({ bay }, i) => {
      const t = tag(String(i + 1), 0.55, { bg: "rgba(34,211,238,.96)", color: "#082f49", size: 72 });
      t.position.set(bay.x, tagHeight(bay) + 0.9, bay.z);
      this.group.add(t);
    });
    let u = 0;
    this.job = (dt) => {
      map.offset.x -= dt * 1.4;
      u = (u + dt * 1.6 / length) % 1;
      walker.position.copy(path.getPointAt(u)).setY(0.3);
    };
    this.stop = stage.onFrame((dt) => this.job(dt));
  }

  remove() {
    this.stop?.();
    this.group.removeFromParent();
    this.group.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
  }
}
