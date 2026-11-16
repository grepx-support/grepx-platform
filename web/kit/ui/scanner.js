/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Scan barcodes and QR codes with a camera - a phone's back camera or a laptop's webcam.
// The browser's own reader (BarcodeDetector: Chrome on Android and Mac, Edge, Safari 17+) is used when there is one;
// elsewhere (e.g. Chrome on Windows) the open-source ZXing reader in /assets/vendor/zxing.min.js is loaded on first use.
// Cameras only open on a secure page (https:// or localhost); on a plain http:// address canScan() is false and pages
// hide their camera buttons - a USB / Bluetooth scanner, which types like a keyboard, works everywhere.
//   const code = await scanBarcode();                         one code, then the camera closes
//   await scanMany((code) => add(code), { title: "Scan IMEIs" })   keeps scanning (each new code once) until Done
import { h } from "../core/dom.js";
import { openDialog } from "./modal.js";

export const canScan = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext !== false;

let zxing = null;
function loadZxing() {
  zxing ||= new Promise((resolve, reject) => {
    if (window.ZXing) return resolve(window.ZXing);
    const s = h("script", { src: "/assets/vendor/zxing.min.js" });
    s.onload = () => resolve(window.ZXing);
    s.onerror = () => { zxing = null; reject(new Error("The barcode reader could not load")); };
    document.head.append(s);
  });
  return zxing;
}

/** A function frame -> codes[] for this browser: its own BarcodeDetector, or ZXing reading a canvas copy of the frame. */
async function reader() {
  if ("BarcodeDetector" in window) {
    try {
      const detector = new window.BarcodeDetector();
      return async (video) => (await detector.detect(video)).map((c) => c.rawValue);
    } catch (e) { /* listed but not usable: fall back */ }
  }
  const Z = await loadZxing();
  const multi = new Z.MultiFormatReader();
  const canvas = h("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth, hgt = video.videoHeight;
    if (!w || !hgt) return [];
    canvas.width = w; canvas.height = hgt;
    ctx.drawImage(video, 0, 0, w, hgt);
    try {
      return [multi.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)))).getText()];
    } catch (e) {
      return [];                                            // nothing readable in this frame
    }
  };
}

function beep() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 1400; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.08);
    setTimeout(() => a.close(), 200);
  } catch (e) { /* no sound */ }
  navigator.vibrate?.(60);
}

/** Opens the camera in a dialog and calls onCode(code) for every new code seen; resolves (list of codes) when closed.
 *  once: close after the first code. */
async function run(onCode, { once = false, title = "Scan a code", hint = "" } = {}) {
  if (!canScan()) return [];
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } } });
  } catch (e) {
    return [];                                               // camera refused or missing
  }
  const box = h("div", { class: "kit-scanbox" });
  const video = h("video", { class: "kit-scan", playsinline: true, muted: true, autoplay: true });
  const status = h("p", { class: "kit-scanstatus", "aria-live": "polite" });
  status.textContent = hint || "Hold the barcode inside the frame.";
  box.append(video, status);
  video.srcObject = stream;
  video.play().catch(() => {});
  const seen = [];
  let timer, open = true;
  const closed = openDialog({ title, body: box, actions: [{ label: once ? "Close" : "Done", value: "", primary: !once }] }).then(() => { open = false; });
  try {
    const read = await reader();
    await new Promise((resolve) => {
      const look = async () => {
        if (!open) return resolve();
        try {
          for (const code of video.readyState >= 2 ? await read(video) : []) {
            if (!code || seen.includes(code)) continue;
            seen.push(code);
            beep();
            onCode?.(code);
            status.textContent = `${seen.length} scanned - last: ${code}`;
            if (once) { box.closest("dialog")?.close(); return resolve(); }
          }
        } catch (e) { /* frame not ready */ }
        timer = setTimeout(look, 200);
      };
      look();
      closed.then(resolve);
    });
  } catch (e) {
    status.textContent = e.message;
    await closed;
  } finally {
    clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
  }
  return seen;
}

/** Resolves the first code seen, or null when the viewer closes the dialog. */
export async function scanBarcode(opts = {}) {
  return (await run(null, { ...opts, once: true }))[0] ?? null;
}

/** Keeps scanning until Done: onCode(code) for each new code; resolves every code scanned. */
export const scanMany = (onCode, opts = {}) => run(onCode, opts);
