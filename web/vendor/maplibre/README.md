MapLibre GL JS 5.24.1 (BSD-3-Clause, https://github.com/maplibre/maplibre-gl-js) - vendored so maps work without a CDN.
`maplibre-gl.js` and `maplibre-gl.css` are `dist/` from the npm package. Loaded on demand by kit/map/maplibre.js.
To upgrade: `npm pack maplibre-gl@<version>` and copy the same two files and LICENSE.txt.
