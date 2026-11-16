/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The building around the racks: concrete floor, yellow aisle lines, zone names painted on the floor and hung above
// each row.
import { THREE } from "../lib/three/stage.js";
import { BAY } from "./plan.js";
import { floorWords, tag } from "../lib/three/labels.js";

const strip = (len, mat, width = 0.09) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(len, width), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  return m;
};

export function building(plan, mats) {
  const g = new THREE.Group(), W = plan.size.w + 30, D = plan.size.d + 30;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mats.floor.map.repeat.set(W / 4, D / 4);
  g.add(floor);
  plan.zones.forEach((z) => {
    const len = z.x1 - z.x0 + 1.2, mid = (z.x0 + z.x1) / 2;
    for (const off of [BAY.d / 2 + 0.35, BAY.d / 2 + BAY.aisle - 0.35]) {
      const line = strip(len, mats.paint);
      line.position.set(mid, 0.01, z.z + off);
      g.add(line);
    }
    const words = floorWords(z.name, 0.8);
    words.position.set(z.x0 - 0.2 + (words.geometry.parameters.width / 2), 0.012, z.z + BAY.d / 2 + BAY.aisle / 2);
    g.add(words);
    const sign = tag(z.name, 0.6, { bg: "rgba(249,115,22,.95)", size: 64 });
    sign.position.set(z.x0 - 1.1, BAY.h + 1.1, z.z);
    g.add(sign);
  });
  if (plan.staging !== null) {
    const words = floorWords("Staging", 0.7, "rgba(56,189,248,.9)");
    words.position.set(-plan.size.w / 2 + 2.6, 0.012, plan.staging + 1.25);
    g.add(words);
  }
  return g;
}
