/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Scan a barcode or QR code with the phone camera (browsers with BarcodeDetector: Chrome on Android, Edge, Safari 17+).
// Elsewhere canScan() is false and pages simply do not show the scan button.
import { h } from "../core/dom.js";
import { openDialog } from "./modal.js";

export const canScan = () => typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

/** Resolves the first code seen, or null when the viewer closes the dialog. */
export async function scanBarcode() {
  if (!canScan()) return null;
  const video = h("video", { class: "kit-scan", playsinline: true, muted: true });
  let stream, found = null, timer;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (e) {
    return null;                                          // camera refused or missing
  }
  video.srcObject = stream;
  video.play();
  const detector = new window.BarcodeDetector();
  const closed = openDialog({ title: "Scan a code", body: video, actions: [{ label: "Close", value: "" }] });
  await new Promise((resolve) => {
    const look = async () => {
      try {
        const codes = video.readyState >= 2 ? await detector.detect(video) : [];
        if (codes.length) { found = codes[0].rawValue; document.querySelector("dialog.kit-dialog")?.close(); return resolve(); }
      } catch (e) { /* frame not ready */ }
      timer = setTimeout(look, 250);
    };
    look();
    closed.then(resolve);
  });
  clearTimeout(timer);
  stream.getTracks().forEach((t) => t.stop());
  return found;
}
