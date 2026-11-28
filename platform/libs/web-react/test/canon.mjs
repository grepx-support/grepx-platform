/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// Turns what is on the page into a stable, comparable text: the same page drawn by the legacy code and by React must give the same text.
// Run inside the page (page.evaluate). Wiring-only attributes (data-*, except what the openers read) and whitespace between elements are
// left out; classes and styles are sorted; form values are read as the browser holds them, not as attributes.
export function canonicalise(root) {
  const KEEP_DATA = /^data-(open-|ask-ai$|ids$|label$|sum$|forget$|bulk-driver$|s$|cell$|find$|bell$)/;     // what the shared openers, the Ask-AI buttons and the stylesheets read
  const BOOL = new Set(["disabled", "hidden", "required", "open", "readonly", "multiple", "autofocus"]);
  const lines = [];
  // Adjacent text nodes are one piece of text to the reader (React writes "2", "vehicle", "s" where the legacy code wrote "2 vehicles").
  const joined = (nodes) => {
    const out = [];
    for (const n of nodes) {
      if (n.nodeType === 3 && out.length && out[out.length - 1].nodeType === 3) out[out.length - 1] = { nodeType: 3, nodeValue: out[out.length - 1].nodeValue + n.nodeValue };
      else out.push(n);
    }
    return out;
  };
  const walk = (node, depth) => {
    if (node.nodeType === 3) {
      const t = node.nodeValue.replace(/\s+/g, " ").replace(/trace [0-9a-f]{12,}/g, "trace ID").trim();   // a trace id is new every request
      if (t) lines.push(`${" ".repeat(depth)}"${t}"`);
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (tag === "script" || tag === "style") return;
    const attrs = [];
    for (const { name: raw, value: rawValue } of node.attributes) {
      // The legacy kit writes aria-current="page" as an attribute whose NAME contains the quotes (it never worked); read it as intended.
      const quirk = raw.match(/^([a-z-]+)="([^"]*)"$/);
      const name = quirk ? quirk[1] : raw;
      let value = quirk ? quirk[2] : rawValue;
      if (name === "aria-current") value = value.split(String.fromCharCode(34)).join("");   // and its value is "page" with the quote characters in it
      if (name.startsWith("data-") && !KEEP_DATA.test(name)) continue;
      if (name === "class") { const c = value.split(/\s+/).filter(Boolean).sort().join(" "); if (c) attrs.push(`class=${c}`); continue; }
      if (name === "style") {
        // A colour written as #rrggbb in markup is read back as rgb(r, g, b) once React has set it through the style object: the same colour.
        const rgb = (x) => x.replace(/#([0-9a-f]{6})/gi, (_m, h) => `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`);
        const moving = (node.className || "").toString().includes("maplibregl");     // a map marker glides and the compass turns with the camera: where they are at that instant is timing, not content
        const s = value.split(";").map((x) => rgb(x.trim().replace(/\s*:\s*/, ":").toLowerCase())).filter((x) => x && !(moving && /^(transform|opacity):/.test(x))).sort().join(";");
        if (s) attrs.push(`style=${s}`);
        continue;
      }
      if (name === "value" || name === "checked" || name === "selected") continue;
      if (name === "rel" && value === "noopener") continue;    // React pages always add it to links that open a new tab (the legacy /docs link had none): safer, not different
      if (BOOL.has(name)) { attrs.push(name); continue; }
      attrs.push(`${name}=${value}`);
    }
    if (tag === "input") {
      const type = node.type;
      if (type === "checkbox" || type === "radio") attrs.push(`checked=${node.checked}`);
      else if (type !== "file") attrs.push(`value=${node.value}`);
    } else if (tag === "select") attrs.push(`value=${[...node.selectedOptions].map((o) => o.value).join(",")}`);
    else if (tag === "textarea") attrs.push(`value=${node.value}`);
    attrs.sort();
    lines.push(`${" ".repeat(depth)}<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`);
    if (tag !== "textarea") {
      let kids = joined(node.childNodes);
      // A React panel or widget is drawn into one plain element inside the drawer, dialog or dashboard-tile body; a legacy panel is drawn straight into it. Look through it.
      if (node.classList?.contains("kit-drawer-body") || node.classList?.contains("kit-dbody") || node.classList?.contains("kit-wbody")) {
        const real = kids.filter((k) => k.nodeType === 1 || (k.nodeType === 3 && k.nodeValue.trim()));
        if (real.length === 1 && real[0].nodeType === 1 && real[0].localName === "div" && !real[0].attributes.length) kids = joined(real[0].childNodes);
      }
      for (const child of kids) walk(child, depth + 1);
    }
  };
  for (const child of joined(root.childNodes)) walk(child, 0);
  return lines.join("\n");
}
