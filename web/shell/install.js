/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The web app as a phone app: registers the service worker (fast starts, an offline page) and, on a phone that is not
// using the installed app yet, offers "Install the app" once (Android: the browser's install; iPhone: how to add it).
const KEY = "grepx.install.dismissed";

function banner(text, action, onAction) {
  const el = document.createElement("div");
  el.className = "kit-install";
  el.innerHTML = `<span></span>${action ? "<button type=\"button\" class=\"btn primary small\" data-go></button>" : ""}<button type="button" class="kit-iconbtn" data-x aria-label="Not now">×</button>`;
  el.querySelector("span").textContent = text;
  if (action) { el.querySelector("[data-go]").textContent = action; el.querySelector("[data-go]").onclick = () => { onAction(); el.remove(); }; }
  el.querySelector("[data-x]").onclick = () => { try { localStorage.setItem(KEY, "1"); } catch { /* private mode */ } el.remove(); };
  document.body.append(el);
}

export function setupInstall(appName = "this app") {
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("/sw.js").catch(() => {});
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const phone = matchMedia("(max-width: 760px)").matches;
  let dismissed = false;
  try { dismissed = !!localStorage.getItem(KEY); } catch { /* private mode */ }
  if (standalone || !phone || dismissed) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    banner(`Install ${appName} on this phone - opens full screen, every feature.`, "Install", () => e.prompt());
  });
  if (/iphone|ipad/i.test(navigator.userAgent)) setTimeout(() => banner(`Install ${appName}: tap Share, then "Add to Home Screen".`), 4000);
}
