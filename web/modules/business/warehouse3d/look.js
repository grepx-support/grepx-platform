/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// How things look: colours for expiry, the shared materials, and the painted concrete floor.
import { THREE } from "../lib/three/stage.js";

export const TONE = { bad: 0xe11d48, warn: 0xf59e0b, info: 0x3b82f6, good: 0x22c55e, none: 0x94a3b8 };
export const KRAFT = 0xc9a26b;
const TINT = { bad: 0.62, warn: 0.55, info: 0.4, good: 0.32, none: 0 };

const FILL = [0x38bdf8, 0x22c55e, 0xfacc15, 0xf97316];   // nearly empty -> full

/** A carton's colour: brown cardboard; tinted towards its expiry colour ("expiry"), or by how full its bin is ("fill"). */
export function cartonColour(tone, mode, fill = 0) {
  const c = new THREE.Color(KRAFT);
  if (mode === "expiry") return c.lerp(new THREE.Color(TONE[tone]), TINT[tone]);
  if (mode !== "fill") return c;
  const at = Math.min(0.999, Math.max(0, fill)) * (FILL.length - 1), i = Math.floor(at);
  return new THREE.Color(FILL[i]).lerp(new THREE.Color(FILL[i + 1]), at - i);
}

function concrete(dark) {
  const n = 512, cv = Object.assign(document.createElement("canvas"), { width: n, height: n }), g = cv.getContext("2d");
  g.fillStyle = dark ? "#1b2333" : "#c9d1dc";
  g.fillRect(0, 0, n, n);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    g.fillStyle = dark ? `rgba(255,255,255,${v * 0.03})` : `rgba(0,0,0,${v * 0.045})`;
    g.fillRect(Math.random() * n, Math.random() * n, 1 + v * 2, 1 + v * 2);
  }
  g.strokeStyle = dark ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.10)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, n - 2, n - 2);                       // slab joints every tile
  const tex = new THREE.CanvasTexture(cv);
  Object.assign(tex, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, colorSpace: THREE.SRGBColorSpace, anisotropy: 8 });
  return tex;
}

export function materials(dark) {
  const std = (color, roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  return {
    upright: std(0x1e40af, 0.38, 0.6),
    beam: std(0xf97316, 0.42, 0.45),
    deck: std(0x8b95a5, 0.5, 0.75),
    carton: std(0xffffff, 0.86, 0),
    tape: std(0xe8dcc4, 0.6, 0),
    pallet: std(0x9a6b3f, 0.9, 0),
    floor: std(0xffffff, 0.9, 0.04, { map: concrete(dark) }),
    paint: new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: dark ? 0.75 : 0.95 }),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    glow: (color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
}
