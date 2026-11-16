/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The WebGL stage shared by the 3D views: renderer, camera, orbit controls, lights and the frame loop.
// Knows nothing about what is drawn on it.
// Stops and frees the GPU when its element leaves the page.
import * as THREE from "/assets/vendor/three/three.module.min.js";
import { OrbitControls } from "/assets/vendor/three/OrbitControls.js";
import { RoomEnvironment } from "/assets/vendor/three/RoomEnvironment.js";

export { THREE };

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

export class Stage {
  constructor(host) {
    Object.assign(this, { host, jobs: [], dark: isDark(), clock: new THREE.Clock() });
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    Object.assign(r, { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, outputColorSpace: THREE.SRGBColorSpace });
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    host.prepend(r.domElement);
    const bg = this.dark ? 0x0a0f1e : 0xe6ecf5;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(bg, 45, 120);
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = this.dark ? 0.35 : 0.6;
    pm.dispose();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(c, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: Math.PI * 0.48, minDistance: 3, maxDistance: 110, autoRotateSpeed: 0.7 });
    this.lights();
    this.resize();
    this.watch = new ResizeObserver(() => this.resize());
    this.watch.observe(host);
    r.setAnimationLoop(() => this.frame());
  }

  lights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, this.dark ? 0x1e293b : 0xb4c0d3, this.dark ? 0.55 : 1.1));
    const sun = this.sun = new THREE.DirectionalLight(this.dark ? 0xc7d2fe : 0xfff4e0, this.dark ? 1.4 : 2.4);
    sun.position.set(16, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow, { bias: -0.0004, normalBias: 0.03, radius: 4 });
    this.scene.add(sun, sun.target);
  }

  /** Shadow box big enough for a floor of w x d metres. */
  fit(w, d) {
    const s = Math.max(w, d) / 2 + 6, cam = this.sun.shadow.camera;
    Object.assign(cam, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 90 });
    cam.updateProjectionMatrix();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.host;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Run fn(dt, t) every frame; returns a function that stops it. */
  onFrame(fn) {
    this.jobs.push(fn);
    return () => { this.jobs = this.jobs.filter((j) => j !== fn); };
  }

  /** The view as it is now, as a PNG data URL (drawn once more first, so the picture is complete). */
  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  frame() {
    if (!this.host.isConnected) return this.dispose();
    const dt = Math.min(this.clock.getDelta(), 0.1), t = this.clock.elapsedTime;
    this.jobs.forEach((fn) => fn(dt, t));
    this.controls.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.watch.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); });
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
