/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// Turns the kit's own markup (icons, donut, avatar, sparkline: trusted, escaped output of /assets/kit) into React elements, so
// those pieces look exactly as they do today without a single dangerouslySetInnerHTML (R-6). Event-handler attributes and
// script elements are never copied.
import { createElement } from "react";

const RENAME = { class: "className", for: "htmlFor", tabindex: "tabIndex", colspan: "colSpan", rowspan: "rowSpan", readonly: "readOnly",
  maxlength: "maxLength", datetime: "dateTime", autocomplete: "autoComplete", autofocus: "autoFocus", enctype: "encType" };

const camel = (s) => s.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());

function style(text) {
  const out = {};
  for (const part of text.split(";")) {
    const at = part.indexOf(":");
    if (at < 1) continue;
    const key = part.slice(0, at).trim();
    out[key.startsWith("--") ? key : camel(key)] = part.slice(at + 1).trim();
  }
  return out;
}

function propsOf(el, key) {
  const props = { key };
  for (const { name, value } of el.attributes) {
    if (/^on/i.test(name)) continue;
    if (name === "style") props.style = style(value);
    else if (name.startsWith("data-") || name.startsWith("aria-")) props[name] = value;
    else if (name === "viewBox" || name === "preserveAspectRatio") props[name] = value;
    else if (RENAME[name]) props[RENAME[name]] = value;
    else props[name.includes("-") ? camel(name) : name] = value === "" && name !== "value" && ["hidden", "checked", "disabled", "selected", "open"].includes(name) ? true : value;
  }
  return props;
}

function convert(node, key) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;
  const tag = node.localName;
  if (tag === "script") return null;
  const kids = [...node.childNodes].map(convert);
  return createElement(tag, propsOf(node, key), ...kids);
}

const cache = new Map();

/** The elements for a kit markup string (a Raw from the kit or a plain string), built once per distinct string. */
export function markup(source) {
  const text = String(source ?? "");
  if (!cache.has(text)) {
    const body = new DOMParser().parseFromString(`<!doctype html><body>${text}`, "text/html").body;
    cache.set(text, [...body.childNodes].map(convert));
    if (cache.size > 500) cache.delete(cache.keys().next().value);
  }
  return cache.get(text);
}

/** <Markup of={donut({...})} /> */
export function Markup({ of }) {
  return <>{markup(of)}</>;
}
