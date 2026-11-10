/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// "Show password": every password box inside `root` gets an eye button that shows or hides what was typed.
import { icon } from "../icons/icons.js";

export function revealPasswords(root = document) {
  root.querySelectorAll('input[type="password"]:not([data-reveal])').forEach((input) => {
    input.dataset.reveal = "";
    const wrap = document.createElement("span");
    wrap.className = "kit-reveal";
    input.replaceWith(wrap);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kit-iconbtn small";
    const show = (on) => {
      input.type = on ? "text" : "password";
      button.innerHTML = String(icon(on ? "eyeoff" : "eye", { size: 16 }));
      button.setAttribute("aria-label", on ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(on));
    };
    button.onclick = () => { show(input.type === "password"); input.focus(); };
    wrap.append(input, button);
    show(false);
  });
}
