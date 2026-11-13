/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// How a drag looks and feels: which box scrolls under the pointer, and the soft landing when a drag ends.
/** The nearest box under the pointer that scrolls up / down by itself (a board column, a list). */
export function scroller(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.scrollHeight > n.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) return n;
  }
  return null;
}

/** The floating copy flies to where the card now is (or back home), then disappears; the card there pops in. */
export function land(ghost, to) {
  const target = to?.isConnected ? to : null;
  if (!target || !ghost.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { ghost.remove(); return; }
  const r = target.getBoundingClientRect();
  target.classList.add("kit-landing");
  ghost.animate([{ transform: ghost.style.transform }, { transform: `translate3d(${r.left}px, ${r.top}px, 0) rotate(0) scale(1)` }],
    { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }).finished.catch(() => {}).then(() => {
    ghost.remove();
    target.classList.remove("kit-landing");
    target.classList.add("kit-landed");
    setTimeout(() => target.classList.remove("kit-landed"), 450);
  });
}
