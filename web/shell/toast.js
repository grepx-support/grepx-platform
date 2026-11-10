/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Short messages at the bottom of the screen.
export function toast(text) {
  const box = document.querySelector("#toast");
  if (!box) return;
  const d = document.createElement("div");
  d.setAttribute("role", "status");
  d.textContent = text;
  box.append(d);
  setTimeout(() => d.remove(), 5000);
}
