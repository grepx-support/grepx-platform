/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Code 128 barcodes as SVG (no library): what every handheld scanner reads - IMEIs, serial numbers, SKUs, bins.
// Digits-only text is packed two digits per symbol (code set C - a 15-digit IMEI ends with one digit in set B), so
// its bars stay short; anything else uses code set B (printable ASCII).
//   code128Svg("356938035643809", { height: 40 })  ->  "<svg ...>"

// Bar / space widths of the 107 symbols (0-105, then STOP with its final bar).
const PATTERNS = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 "
  + "221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 "
  + "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 "
  + "221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 "
  + "121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 "
  + "211412 211214 211232 2331112").split(" ");
const CODE_B = 100, START_B = 104, START_C = 105, STOP = 106;

/** The symbol values for text (start, data, checksum, stop). Throws for characters a label can't carry. */
export function code128Values(text) {
  const s = String(text ?? "");
  if (!s) throw new Error("Nothing to encode");
  const asB = (str) => [...str].map((ch) => {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) throw new Error("Only plain letters, digits and symbols can go in a barcode");
    return c - 32;
  });
  const setC = /^\d+$/.test(s) && s.length >= 4;                 // e.g. a 15-digit IMEI: 7 pairs in set C, then the last digit in set B
  const even = setC ? s.slice(0, s.length - (s.length % 2)) : "";
  const data = setC ? [...even.match(/\d\d/g).map(Number), ...(s.length % 2 ? [CODE_B, ...asB(s.slice(-1))] : [])] : asB(s);
  const start = setC ? START_C : START_B;
  const check = data.reduce((sum, v, i) => sum + v * (i + 1), start) % 103;
  return [start, ...data, check, STOP];
}

/** An SVG barcode. module: width of the thinnest bar (in SVG units); quiet: blank modules each side; text: the human-readable line. */
export function code128Svg(text, { height = 40, module = 1, quiet = 10, showText = true, fontSize = 10 } = {}) {
  const bars = [];
  let x = quiet * module;
  for (const value of code128Values(text)) {
    const widths = PATTERNS[value];
    for (let i = 0; i < widths.length; i++) {
      const w = Number(widths[i]) * module;
      if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${w}" height="${height}"/>`);
      x += w;
    }
  }
  const width = x + quiet * module, total = height + (showText ? fontSize + 4 : 0);
  const label = String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${total}" preserveAspectRatio="none" role="img" aria-label="Barcode ${label}" class="kit-barcode">`
    + `<rect width="${width}" height="${total}" fill="#fff"/><g fill="#000">${bars.join("")}</g>`
    + (showText ? `<text x="${width / 2}" y="${total - 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000">${label}</text>` : "")
    + "</svg>";
}
