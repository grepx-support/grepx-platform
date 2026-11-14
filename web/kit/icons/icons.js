/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Line icons (24x24, drawn with the current text colour). Products add their own with registerIcons().
import { raw } from "../core/dom.js";

const ICONS = {
  home: "M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10",
  box: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9",
  truck: "M2 6h11v10H2zM13 9h4l4 4v3h-8M6.5 19a1.5 1.5 0 1 0 0-.01M17.5 19a1.5 1.5 0 1 0 0-.01",
  pot: "M4 10h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM2 10h20M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2",
  cart: "M3 4h2l2.5 11h11L21 7H6.5M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01",
  clipboard: "M9 4h6v3H9zM7 5H5v16h14V5h-2M8 12l3 3 5-6",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3M20 16V6",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.6 1.6 0 0 0-1.8 0 1.6 1.6 0 0 0-.9 1.4V22h-4v-.3a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1A1.6 1.6 0 0 0 5 15a1.6 1.6 0 0 0-1.5-1H3v-4h.3A1.6 1.6 0 0 0 5 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1A1.6 1.6 0 0 0 9.3 5 1.6 1.6 0 0 0 10 3.5V3h4v.3a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1A1.6 1.6 0 0 0 19 9a1.6 1.6 0 0 0 1.5 1h.5v4h-.3a1.6 1.6 0 0 0-1.3 1z",
  building: "M4 21V5l8-3v19M12 9h8v12M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2M2 21h20",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M18 15a6 6 0 0 1 4 5v1",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  check: "M5 12l5 5 9-10",
  grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  menu: "M3 6h18M3 12h18M3 18h18",
  arrow: "M5 12h14M13 6l6 6-6 6",
  alert: "M12 3 2 20h20zM12 10v4M12 17h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4M12 15v2",
  inbox: "M3 13h5l1 3h6l1-3h5M5 5h14l2 8v6H3v-6z",
  outbox: "M12 15V3M8 7l4-4 4 4M3 13h5l1 3h6l1-3h5v6H3z",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  layout: "M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeoff: "M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7a9.5 9.5 0 0 0 5.4-1.6",
  resize: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7",
  refresh: "M20 11a8 8 0 0 0-14.7-4.3L3 9M3 4v5h5M4 13a8 8 0 0 0 14.7 4.3L21 15M21 20v-5h-5",
  logout: "M15 4h4v16h-4M10 17l5-5-5-5M15 12H3",
  store: "M3 9l2-5h14l2 5M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v8h14v-8M10 21v-5h4v5",
  pin: "M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  copy: "M8 8h12v12H8zM4 16V4h12",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9a3 2 0 0 0-3-1.5c-1.7 0-3 .8-3 2s1.3 1.6 3 2 3 .9 3 2.1-1.3 2-3 2a3 2 0 0 1-3-1.5M12 6v1.5M12 16.5V18",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  dot: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  board: "M3 4h5v16H3zM10 4h5v10h-5zM17 4h4v13h-4z",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  message: "M4 4h16v12H8l-4 4z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  phone: "M7 2h10v20H7zM11 18h2",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5v.5",
  task: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  camera: "M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  cube: "M12 2l9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  flame: "M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z",
  play: "M7 4l13 8-13 8z",
  pause: "M7 4h4v16H7zM14 4h4v16h-4z",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h4",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  command: "M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z",
  chevron: "M6 9l6 6 6-6",
};

export function registerIcons(more) { Object.assign(ICONS, more); }
export const hasIcon = (name) => name in ICONS;

/** icon("box") -> Raw <svg>; unknown names draw a dot. */
export function icon(name, { size = 18, label = "" } = {}) {
  const d = ICONS[name] || ICONS.dot;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "")}"` : 'aria-hidden="true"';
  return raw(`<svg class="kit-icon" ${a11y} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`);
}
