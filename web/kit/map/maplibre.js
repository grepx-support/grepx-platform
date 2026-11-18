/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// MapLibre GL (BSD-3, web/vendor/maplibre/) - WebGL maps with tilt, rotation and 3D buildings - loaded the first time a
// page needs a map, never before (it is about 1 MB). Resolves to the maplibregl namespace; null when WebGL is missing.
const BASE = new URL("../../vendor/maplibre/", import.meta.url).href;
let loading = null;

export function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (!hasWebGL()) return Promise.resolve(null);
  loading ||= new Promise((resolve, reject) => {
    const css = Object.assign(document.createElement("link"), { rel: "stylesheet", href: `${BASE}maplibre-gl.css` });
    const js = Object.assign(document.createElement("script"), { src: `${BASE}maplibre-gl.js`, async: true });
    js.onload = () => resolve(window.maplibregl);
    js.onerror = () => { loading = null; reject(new Error("The map could not load")); };
    document.head.append(css, js);
  });
  return loading;
}
