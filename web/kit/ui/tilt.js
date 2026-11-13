/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Cards that lean towards the pointer, with a soft light where it is. One listener for the whole page (event delegation),
// so new cards need no wiring; off on touch screens and for reduced motion.
export function enableTilt(selector, max = 7) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !matchMedia("(hover: hover)").matches) return;
  let current = null;
  const reset = (el) => { el.style.removeProperty("--rx"); el.style.removeProperty("--ry"); el.classList.remove("kit-tilting"); };
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(selector);
    if (current && current !== el) reset(current);
    current = el;
    if (!el) return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.classList.add("kit-tilting");
    el.style.setProperty("--rx", `${(0.5 - py) * max}deg`);
    el.style.setProperty("--ry", `${(px - 0.5) * max}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
  }, { passive: true });
}
