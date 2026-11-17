/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// QR codes as SVG (a link on a printed card, a warranty, a job slip) - qrcode-generator (MIT, web/external/) does the encoding.
import qrcode from "../../external/qrcode.js";
import { raw } from "../core/dom.js";

/** qrSvg("https://...", { size: 120, label: "Scan to track" }) -> markup; error correction M, black on white. */
export function qrSvg(text, { size = 120, margin = 2, label = "" } = {}) {
  const qr = qrcode(0, "M");
  qr.addData(String(text));
  qr.make();
  const n = qr.getModuleCount(), cells = n + margin * 2;
  let path = "";
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
  return raw(`<svg class="kit-qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cells} ${cells}" width="${size}" height="${size}" shape-rendering="crispEdges"
    role="img" aria-label="${label ? label.replace(/"/g, "&quot;") : "QR code"}"><rect width="${cells}" height="${cells}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`);
}
