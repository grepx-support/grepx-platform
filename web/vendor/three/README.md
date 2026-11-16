three.js r170 (MIT, https://github.com/mrdoob/three.js) - vendored so the 3D warehouse works without a CDN.
`three.module.min.js` is `build/three.module.min.js`; `OrbitControls.js` is `examples/jsm/controls/OrbitControls.js` with its
`from 'three'` import pointed at the file next to it. To upgrade: `npm pack three@<version>` and copy the same two files.
