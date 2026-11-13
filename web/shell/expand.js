/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Every chart on every page can be opened large: an expand button appears on each chart figure as pages render, and
// opens it in a wide dialog (links in the chart still go to their pages). Pages need not do anything.
import { icon, openDialog } from "../kit/index.js";

const CHARTS = "figure.kit-chart, figure.kit-donut";

function titleOf(fig) {
  const box = fig.closest(".kit-widget, .card, section");
  return box?.querySelector("h1, h2, h3")?.textContent.trim() || "Chart";
}

function enhance(fig) {
  if (fig.dataset.expand) return;
  fig.dataset.expand = "1";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "kit-expand";
  btn.title = "Open large";
  btn.setAttribute("aria-label", "Open this chart large");
  btn.innerHTML = String(icon("expand", { size: 15 }));
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const big = fig.cloneNode(true);
    big.querySelector(".kit-expand")?.remove();
    big.classList.add("kit-big");
    big.addEventListener("click", (ev) => { if (ev.target.closest("a[href]")) big.closest("dialog")?.close(); });   // a link opens its page
    openDialog({ title: titleOf(fig), body: big, wide: true });
  });
  fig.append(btn);
}

/** Watch a root (the page view) and give each chart that appears an expand button. */
export function startExpand(root = document.querySelector("#view")) {
  if (!root) return;
  const scan = () => root.querySelectorAll(CHARTS).forEach(enhance);
  new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  scan();
}

