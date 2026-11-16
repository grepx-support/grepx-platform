/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Text in the 3D scene, drawn on a canvas: floating tags (always face the camera) and words painted on the floor.
import { THREE } from "./stage.js";

function paint(text, { size = 56, color = "#fff", bg = "rgba(15,23,42,.85)", pad = 18, radius = 16, weight = 700 } = {}) {
  const cv = document.createElement("canvas"), g = cv.getContext("2d"), font = `${weight} ${size}px Inter, system-ui, sans-serif`;
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + pad * 2, h = size + pad * 1.6;
  Object.assign(cv, { width: w, height: h });
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, radius); g.fill(); }
  Object.assign(g, { font, fillStyle: color, textBaseline: "middle", textAlign: "center" });
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, ratio: w / h };
}

/** A tag that always faces the camera; height in metres. */
export function tag(text, height = 0.42, opts) {
  const { tex, ratio } = paint(text, opts);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(height * ratio, height, 1);
  return s;
}

/** Words lying flat on the floor, reading from the front. */
export function floorWords(text, height = 0.9, color = "rgba(250,204,21,.9)") {
  const { tex, ratio } = paint(text.toUpperCase(), { size: 96, color, bg: null, weight: 800 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(height * ratio, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.012;
  return m;
}
