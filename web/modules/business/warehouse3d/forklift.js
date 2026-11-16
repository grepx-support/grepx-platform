/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A small forklift that drives the aisles on a loop, lifting its forks now and then, with a flashing beacon.
// Built from boxes and cylinders; it faces +z, the way it drives.
import { THREE } from "../lib/three/stage.js";
import { BAY } from "./plan.js";

function model() {
  const g = new THREE.Group(), std = (c, r = 0.5, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const yellow = std(0xfacc15, 0.4, 0.3), black = std(0x111827, 0.7, 0.1), steel = std(0x9ca3af, 0.35, 0.8);
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  part(new THREE.BoxGeometry(1.1, 0.7, 1.7), yellow, 0, 0.6, -0.1);                // body
  part(new THREE.BoxGeometry(1.1, 0.5, 0.45), black, 0, 0.75, -0.95);              // counterweight
  for (const [x, z] of [[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.75], [0.5, -0.75]]) part(new THREE.BoxGeometry(0.06, 1.3, 0.06), black, x, 1.6, z);
  part(new THREE.BoxGeometry(1.15, 0.06, 1.35), black, 0, 2.27, -0.15);             // roof guard
  part(new THREE.BoxGeometry(0.5, 0.45, 0.5), black, 0, 1.12, -0.35);               // seat
  for (const x of [-0.35, 0.35]) part(new THREE.BoxGeometry(0.08, 2.6, 0.1), steel, x, 1.45, 0.82);  // mast
  const forks = new THREE.Group();
  for (const x of [-0.25, 0.25]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.0), steel); f.position.set(x, 0, 0.5); f.castShadow = true; forks.add(f); }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), black);
  plate.position.set(0, 0.25, 0);
  forks.add(plate);
  forks.position.set(0, 0.12, 0.9);
  g.add(forks);
  const wheel = new THREE.CylinderGeometry(0.28, 0.28, 0.22, 20);
  for (const [x, z] of [[-0.58, 0.45], [0.58, 0.45], [-0.58, -0.7], [0.58, -0.7]]) part(wheel, black, x, 0.28, z).rotation.z = Math.PI / 2;
  const beacon = part(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff8a00 }), 0, 2.38, -0.15);
  return { g, forks, beacon };
}

/** Points along the middle of every aisle, snaking from one end to the other, closed into a loop. */
function route(plan) {
  if (!plan.zones.length) return null;
  const x0 = Math.min(...plan.zones.map((z) => z.x0)) - 2.2, x1 = Math.max(...plan.zones.map((z) => z.x1)) + 2.2;
  const pts = [];
  plan.zones.forEach((z, i) => {
    const lane = z.z + BAY.d / 2 + BAY.aisle / 2;
    const [a, b] = i % 2 ? [x1, x0] : [x0, x1];
    pts.push(new THREE.Vector3(a, 0, lane), new THREE.Vector3((a + b) / 2, 0, lane), new THREE.Vector3(b, 0, lane));
  });
  if (plan.zones.length % 2) { const last = pts[pts.length - 1]; pts.push(new THREE.Vector3(last.x, 0, last.z - 1.5)); }
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.2);
}

export function forklift(stage, plan) {
  const path = route(plan);
  if (!path) return null;
  const { g, forks, beacon } = model(), length = path.getLength(), ahead = new THREE.Vector3();
  let u = 0;
  stage.onFrame((dt, t) => {
    u = (u + (dt * 2.2) / length) % 1;
    g.position.copy(path.getPointAt(u));
    g.lookAt(ahead.copy(path.getPointAt((u + 0.004) % 1)));
    forks.position.y = 0.12 + Math.max(0, Math.sin(t * 0.5)) * 1.4;
    beacon.visible = Math.sin(t * 8) > 0;
  });
  return g;
}
