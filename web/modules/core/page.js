/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Each business's own public page, the same in every business product:
//   /b/<name>       what visitors see: offers, highlights, brands, videos, social links, how to find the business
//   #/setup/page    the owner (or GrepX support) chooses what is shown, with a live preview, and publishes it
// product.json "page_defaults": {headline, intro, highlights[]} in the product's words, used until the owner writes their own.
import { api, esc, run, state, toast } from "../../app.js";

const SECTIONS = [["offers", "Offers and promotions"], ["highlights", "Why choose us"], ["brands", "Brands"], ["videos", "Videos"],
  ["social", "Follow us (social links)"], ["visit", "Visit us (address, hours, map)"], ["sign_in", "Staff sign-in button"]];
const SOCIAL = [["instagram", "Instagram"], ["facebook", "Facebook"], ["youtube", "YouTube"], ["website", "Website"]];
const SVG = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/>',
  facebook: '<path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
  website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
};
const ico = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVG[name] || ""}</svg>`;
const media = (id) => `/api/v1/media/${encodeURIComponent(id)}`;
const digits = (v) => String(v || "").replace(/\D/g, "");
const fmtDay = (d) => { try { return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch (e) { return d; } };

function css() {
  if (document.querySelector("#pp-css")) return;
  const s = document.createElement("style");
  s.id = "pp-css";
  s.textContent = `
.pp{--acc:#C9A96E;--ink:rgba(255,255,255,.92);--body:rgba(255,255,255,.78);--mute:rgba(255,255,255,.58);--line:rgba(255,255,255,.09);--surf:#141414;
 font-family:Inter,system-ui,sans-serif;color:var(--ink);background:radial-gradient(ellipse at 50% 0%,#151515 0%,#0B0B0B 55%,#080808 100%);min-height:100%;color-scheme:dark}
.pp a{color:inherit}
.pp-in{max-width:1200px;margin:0 auto;padding:0 24px}
.pp-bar{background:var(--acc);color:#0B0B0B;font-weight:700;font-size:14px;text-align:center;padding:10px 16px}
.pp-bar a{text-decoration:underline;margin-left:8px}
.pp-top{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 0}
.pp-brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.pp-mark{width:46px;height:46px;border-radius:14px;background:var(--acc);color:#0B0B0B;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;overflow:hidden}
.pp-mark img{width:100%;height:100%;object-fit:contain;background:#fff}
.pp-brand b{display:block;font-size:18px} .pp-brand small{color:var(--mute);font-size:12px}
.pp-nav{display:flex;gap:22px;font-size:14px;font-weight:600} .pp-nav a{text-decoration:none;color:var(--body)} .pp-nav a:hover{color:#fff}
.pp-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pp-ic{width:44px;height:44px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center;text-decoration:none}
.pp-ic:hover{border-color:var(--acc);color:var(--acc)}
.pp-btn{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 22px;border-radius:14px;font-weight:700;font-size:15px;text-decoration:none;border:1px solid transparent}
.pp-btn.solid{background:var(--acc);color:#0B0B0B} .pp-btn.solid:hover{box-shadow:0 0 50px color-mix(in srgb,var(--acc) 35%,transparent)}
.pp-btn.line{border-color:rgba(255,255,255,.2);color:var(--ink)} .pp-btn.line:hover{border-color:var(--acc)}
.pp-btn.wa{background:#25D366;color:#0B0B0B}
.pp-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:48px;align-items:center;padding:40px 0 72px}
.pp-kick{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:13px;color:var(--body)}
.pp-dot{width:8px;height:8px;border-radius:50%;background:#FF5A5F;box-shadow:0 0 0 4px rgba(255,90,95,.18)}
.pp-h1{margin:18px 0 0;font-size:64px;line-height:1.03;letter-spacing:-.02em;font-weight:800}
.pp-h1 span{background:linear-gradient(135deg,var(--acc),#fff 160%);-webkit-background-clip:text;background-clip:text;color:transparent}
.pp-lead{margin:18px 0 0;font-size:19px;line-height:1.55;color:var(--body);max-width:540px}
.pp-cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
.pp-feat{border-radius:28px;background:var(--acc);color:#0B0B0B;padding:28px;min-height:420px;display:flex;flex-direction:column;justify-content:space-between;gap:16px;position:relative;overflow:hidden}
.pp-feat .pp-img{height:220px;border-radius:20px;background:rgba(11,11,11,.08) center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:56px;color:rgba(11,11,11,.25)}
.pp-badge{align-self:flex-start;background:#0B0B0B;color:#fff;font-size:12px;font-weight:800;letter-spacing:.08em;padding:7px 12px;border-radius:999px;text-transform:uppercase}
.pp-feat h2{margin:0;font-size:34px;line-height:1.08;font-weight:800} .pp-feat p{margin:6px 0 0;font-weight:500}
.pp-feat .pp-end{font-size:13px;font-weight:700}
.pp-sec{padding:72px 0} .pp-band{background:#0F0F0F;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.pp-k{margin:0 0 8px;color:var(--acc);font-weight:800;font-size:13px;letter-spacing:.12em;text-transform:uppercase}
.pp-h2{margin:0 0 28px;font-size:40px;font-weight:800;letter-spacing:-.01em}
.pp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}
.pp-card{background:var(--surf);border:1px solid var(--line);border-radius:22px;overflow:hidden;display:flex;flex-direction:column}
.pp-card .pp-img{height:190px;background:#1A1A1A center/cover no-repeat;position:relative}
.pp-card .pp-badge{position:absolute;top:14px;left:14px;background:var(--acc);color:#0B0B0B}
.pp-card .pp-body{padding:20px;display:flex;flex-direction:column;gap:8px;flex:1}
.pp-card h3{margin:0;font-size:20px;font-weight:800} .pp-card p{margin:0;color:var(--body);line-height:1.5}
.pp-card .pp-row{margin-top:auto;display:flex;justify-content:space-between;align-items:center;gap:8px;padding-top:8px;font-size:13px;color:var(--mute)}
.pp-card .pp-row a{color:var(--acc);font-weight:700;text-decoration:none}
.pp-hl{background:var(--surf);border:1px solid var(--line);border-radius:22px;padding:26px;display:flex;flex-direction:column;gap:10px}
.pp-hl i{width:46px;height:46px;border-radius:14px;background:#1E1E1E;color:var(--acc);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:800}
.pp-hl h3{margin:0;font-size:20px} .pp-hl p{margin:0;color:var(--body);line-height:1.5}
.pp-chips{display:flex;gap:10px;flex-wrap:wrap} .pp-chips span{padding:12px 20px;border-radius:14px;border:1px solid var(--line);font-weight:700}
.pp-vid{position:relative;padding-top:56.25%;border-radius:20px;overflow:hidden;background:#111;border:1px solid var(--line)}
.pp-vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.pp-social{display:flex;gap:12px;flex-wrap:wrap}
.pp-visit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
.pp-info{display:flex;flex-direction:column;gap:14px;font-size:16px;color:var(--body)} .pp-info div{display:flex;gap:12px;align-items:flex-start}
.pp-info svg{color:var(--acc);flex-shrink:0;margin-top:2px}
.pp-foot{border-top:1px solid var(--line);padding:28px 0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:var(--mute);font-size:13px}
@media (max-width:900px){.pp-hero,.pp-visit{grid-template-columns:minmax(0,1fr)} .pp-grid{grid-template-columns:minmax(0,1fr)} .pp-h1{font-size:42px} .pp-nav{display:none} .pp-feat{min-height:0}}
.pe{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:20px;align-items:start}
.pe-form{display:flex;flex-direction:column;gap:14px}
.pe-form fieldset{border:1px solid var(--line,#e5e7eb);border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;gap:10px;margin:0}
.pe-form legend{font-weight:700;padding:0 6px}
.pe-form label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:600}
.pe-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.pe-tog{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.pe-tog label{flex-direction:row !important;align-items:center;gap:8px !important;font-weight:500 !important}
.pe-promo{border:1px dashed var(--line,#d1d5db);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}
.pe-thumb{width:64px;height:44px;border-radius:8px;background:#ddd center/cover no-repeat;flex-shrink:0}
.pe-prev{position:sticky;top:12px;border-radius:16px;overflow:hidden;border:1px solid var(--line,#e5e7eb);max-height:calc(100vh - 120px);overflow-y:auto}
.pe-prev .pp{zoom:.62}
.pe-addr{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
.pe-form input[type=color]{height:44px;padding:4px;cursor:pointer}
@media (max-width:1100px){.pe{grid-template-columns:minmax(0,1fr)} .pe-prev{position:static}}`;
  document.head.append(s);
}

/** Until the owner writes their own: the business's name and the product's words. */
function defaults(name) {
  const d = state.product.page_defaults || {};
  return { company: name || "", tagline: d.tagline || "", headline: d.headline || `Welcome to ${name || "our business"}`, intro: d.intro || "",
    color: "#C9A96E", logo_id: "", phone: "", whatsapp: "", email: "", address: "", hours: "", footer: "",
    social: { instagram: "", facebook: "", youtube: "", website: "", map: "" }, promotions: [], highlights: d.highlights || [], brands: [], videos: [],
    sections: Object.fromEntries(SECTIONS.map(([k]) => [k, true])) };
}

const today = () => new Date().toISOString().slice(0, 10);
const live = (p) => (p.promotions || []).filter((x) => (!x.starts || x.starts <= today()) && (!x.ends || x.ends >= today()));

/** The public page as HTML (also the editor's preview). p: the page; slug: its address. */
export function pageHtml(p, slug, preview = false) {
  const on = (k) => (p.sections || {})[k] !== false;
  const promos = on("offers") ? live(p) : [], first = promos[0];
  const social = SOCIAL.filter(([k]) => (p.social || {})[k]);
  const wa = digits(p.whatsapp) && `https://wa.me/${digits(p.whatsapp)}`;
  const map = (p.social || {}).map || (p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}` : "");
  const signIn = slug ? `/b/${esc(slug)}/app#/login` : "#/login";
  const words = String(p.headline || "").split(" "), cut = Math.max(1, Math.ceil(words.length / 2));
  const headline = `${esc(words.slice(0, cut).join(" "))} <span>${esc(words.slice(cut).join(" "))}</span>`;
  const img = (id) => id ? ` style="background-image:url('${media(id)}')"` : "";
  const ends = (x) => x.ends ? `Ends ${esc(fmtDay(x.ends))}` : "While stock lasts";
  const link = (x, label) => x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">${label}</a>` : wa ? `<a href="${wa}?text=${encodeURIComponent(`Hi! About "${x.title}"`)}" target="_blank" rel="noopener">${label}</a>` : "";
  const target = preview ? ' tabindex="-1"' : "";
  return `<div class="pp" style="--acc:${esc(p.color || "#C9A96E")}">
  ${first ? `<div class="pp-bar">${esc(first.badge || "Offer")}: ${esc(first.title)}<a href="#pp-offers"${target}>See offers</a></div>` : ""}
  <div class="pp-in"><header class="pp-top"><a class="pp-brand" href="#pp-top"${target}><span class="pp-mark">${p.logo_id ? `<img src="${media(p.logo_id)}" alt="">` : esc((p.company || "?")[0])}</span>
      <span><b>${esc(p.company)}</b>${p.tagline ? `<small>${esc(p.tagline)}</small>` : ""}</span></a>
    <nav class="pp-nav">${promos.length ? `<a href="#pp-offers"${target}>Offers</a>` : ""}${on("videos") && (p.videos || []).length ? `<a href="#pp-videos"${target}>Videos</a>` : ""}${on("visit") ? `<a href="#pp-visit"${target}>Visit us</a>` : ""}</nav>
    <div class="pp-acts">${on("social") ? social.map(([k, l]) => `<a class="pp-ic" href="${esc(p.social[k])}" target="_blank" rel="noopener" aria-label="${l}"${target}>${ico(k)}</a>`).join("") : ""}
      ${wa ? `<a class="pp-btn wa" href="${wa}" target="_blank" rel="noopener"${target}>${ico("whatsapp", 16)} WhatsApp</a>` : ""}
      ${on("sign_in") ? `<a class="pp-btn line" href="${signIn}"${target}>Sign in</a>` : ""}</div></header>
  <section class="pp-hero" id="pp-top"><div>${promos.length ? `<span class="pp-kick"><span class="pp-dot"></span>${promos.length} live offer${promos.length > 1 ? "s" : ""} right now</span>` : ""}
      <h1 class="pp-h1">${headline}</h1>${p.intro ? `<p class="pp-lead">${esc(p.intro)}</p>` : ""}
      <div class="pp-cta">${promos.length ? `<a class="pp-btn solid" href="#pp-offers"${target}>See today's offers ${ico("arrow", 16)}</a>` : ""}
        ${wa ? `<a class="pp-btn line" href="${wa}" target="_blank" rel="noopener"${target}>${ico("whatsapp", 16)} Chat with us</a>` : ""}
        ${p.phone ? `<a class="pp-btn line" href="tel:${esc(p.phone.replace(/\s/g, ""))}"${target}>${ico("phone", 16)} Call</a>` : ""}
        ${map && on("visit") ? `<a class="pp-btn line" href="${esc(map)}" target="_blank" rel="noopener"${target}>${ico("pin", 16)} Directions</a>` : ""}</div></div>
    ${first ? `<div class="pp-feat"><span class="pp-badge">${esc(first.badge || "Offer")}</span><div class="pp-img"${img(first.image_id)}>${first.image_id ? "" : "%"}</div>
      <div><h2>${esc(first.title)}</h2>${first.text ? `<p>${esc(first.text)}</p>` : ""}</div><span class="pp-end">${ends(first)}</span></div>`
      : `<div class="pp-feat"><div class="pp-img"${img(p.logo_id)}>${p.logo_id ? "" : esc((p.company || "?")[0])}</div><div><h2>${esc(p.company)}</h2>${p.tagline ? `<p>${esc(p.tagline)}</p>` : ""}</div></div>`}
  </section></div>
  ${promos.length ? `<section class="pp-sec pp-band" id="pp-offers"><div class="pp-in"><p class="pp-k">Offers</p><h2 class="pp-h2">Today's deals</h2><div class="pp-grid">
    ${promos.map((x) => `<article class="pp-card"><div class="pp-img"${img(x.image_id)}>${x.badge ? `<span class="pp-badge">${esc(x.badge)}</span>` : ""}</div>
      <div class="pp-body"><h3>${esc(x.title)}</h3>${x.text ? `<p>${esc(x.text)}</p>` : ""}<div class="pp-row"><span>${ends(x)}</span>${link(x, "Ask about it →")}</div></div></article>`).join("")}
  </div></div></section>` : ""}
  ${on("highlights") && (p.highlights || []).length ? `<section class="pp-sec"><div class="pp-in"><p class="pp-k">Why us</p><h2 class="pp-h2">Why people choose ${esc(p.company)}</h2><div class="pp-grid">
    ${p.highlights.map((h, i) => `<div class="pp-hl"><i>${String(i + 1).padStart(2, "0")}</i><h3>${esc(h.title)}</h3>${h.text ? `<p>${esc(h.text)}</p>` : ""}</div>`).join("")}</div></div></section>` : ""}
  ${on("brands") && (p.brands || []).length ? `<section class="pp-sec" style="padding-top:0"><div class="pp-in"><p class="pp-k">Brands</p><div class="pp-chips">${p.brands.map((b) => `<span>${esc(b)}</span>`).join("")}</div></div></section>` : ""}
  ${on("videos") && (p.videos || []).length ? `<section class="pp-sec pp-band" id="pp-videos"><div class="pp-in"><p class="pp-k">Watch</p><h2 class="pp-h2">Latest videos</h2><div class="pp-grid">
    ${p.videos.map((v) => preview ? `<div class="pp-vid" style="background:#111 url('https://i.ytimg.com/vi/${esc(v)}/hqdefault.jpg') center/cover"></div>`
      : `<div class="pp-vid"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${esc(v)}" title="Video" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`).join("")}</div>
    ${(p.social || {}).youtube ? `<p style="margin-top:20px"><a class="pp-btn line" href="${esc(p.social.youtube)}" target="_blank" rel="noopener"${target}>${ico("youtube", 16)} Subscribe on YouTube</a></p>` : ""}</div></section>` : ""}
  ${on("social") && social.length ? `<section class="pp-sec"><div class="pp-in"><p class="pp-k">Follow us</p><h2 class="pp-h2">New stock and offers, first on our socials</h2><div class="pp-social">
    ${social.map(([k, l]) => `<a class="pp-btn ${k === "instagram" ? "solid" : "line"}" href="${esc(p.social[k])}" target="_blank" rel="noopener"${target}>${ico(k, 16)} ${l}</a>`).join("")}</div></div></section>` : ""}
  ${on("visit") && (p.address || p.hours || p.phone || p.email) ? `<section class="pp-sec pp-band" id="pp-visit"><div class="pp-in pp-visit"><div><p class="pp-k">Visit us</p><h2 class="pp-h2">Come and see us</h2>
      <div class="pp-cta">${map ? `<a class="pp-btn solid" href="${esc(map)}" target="_blank" rel="noopener"${target}>${ico("pin", 16)} Get directions</a>` : ""}${wa ? `<a class="pp-btn wa" href="${wa}" target="_blank" rel="noopener"${target}>${ico("whatsapp", 16)} WhatsApp</a>` : ""}</div></div>
    <div class="pp-info">${p.address ? `<div>${ico("pin")}<span style="white-space:pre-line">${esc(p.address)}</span></div>` : ""}${p.hours ? `<div>${ico("clock")}<span>${esc(p.hours)}</span></div>` : ""}
      ${p.phone ? `<div>${ico("phone")}<a href="tel:${esc(p.phone.replace(/\s/g, ""))}"${target}>${esc(p.phone)}</a></div>` : ""}${p.email ? `<div>${ico("mail")}<a href="mailto:${esc(p.email)}"${target}>${esc(p.email)}</a></div>` : ""}</div></div></section>` : ""}
  <div class="pp-in"><footer class="pp-foot"><span>© ${new Date().getFullYear()} ${esc(p.company)}${p.footer ? ` · ${esc(p.footer)}` : ""}</span><span>Runs on ${esc(state.product.name)}</span></footer></div></div>`;
}

async function publicPage(el, { args }) {
  css();
  el.innerHTML = '<div class="pp" style="display:flex;align-items:center;justify-content:center;min-height:100vh"><p>Loading...</p></div>';
  try {
    const r = await api(`/public/page/${encodeURIComponent(args[0])}`);
    if (r.moved) history.replaceState(null, "", `/b/${r.slug}#/b/${r.slug}`);
    const p = r.page || defaults(r.name);
    document.title = p.company || r.name;
    el.innerHTML = pageHtml(p, r.slug);
    el.querySelectorAll('a[href^="#pp-"]').forEach((a) => a.onclick = (e) => { e.preventDefault(); el.querySelector(a.getAttribute("href"))?.scrollIntoView({ behavior: "smooth" }); });
  } catch (e) {
    el.innerHTML = `<div class="pp" style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center"><div><h1 class="pp-h2">No business here</h1>
      <p style="color:var(--body)">Check the address, or start your own.</p>${state.product.signup === "business" ? '<a class="pp-btn solid" href="/#/signup">Start free</a>' : ""}</div></div>`;
  }
}

// ---------- the owner's editor ----------
const field = (name, label, value, attrs = "") => `<label>${label}<input name="${name}" value="${esc(value || "")}" ${attrs}></label>`;

function promoRow(x = {}) {
  return `<div class="pe-promo" data-promo><div class="pe-two">${field("p_title", "Title", x.title, 'maxlength="90" placeholder="e.g. Exchange bonus on all phones"')}
      ${field("p_badge", "Badge", x.badge, 'maxlength="24" placeholder="e.g. NEW, -20%"')}</div>
    <label>Details<input name="p_text" value="${esc(x.text || "")}" maxlength="240"></label>
    <div class="pe-two">${field("p_starts", "Starts", x.starts, 'type="date"')}${field("p_ends", "Ends", x.ends, 'type="date"')}</div>
    <label>Link (optional - else visitors ask on WhatsApp)<input name="p_link" value="${esc(x.link || "")}" placeholder="https://instagram.com/p/..."></label>
    <input type="hidden" name="p_image" value="${esc(x.image_id || "")}">
    <div class="row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span class="pe-thumb" ${x.image_id ? `style="background-image:url('${media(x.image_id)}')"` : ""}></span>
      <label class="btn small" style="flex-direction:row;cursor:pointer">Picture<input type="file" accept="image/*" data-pic hidden></label>
      <button type="button" class="btn small" data-up>↑</button><button type="button" class="btn small" data-drop>Remove</button></div></div>`;
}

function hlRow(h = {}) {
  return `<div class="pe-two" data-hl>${field("h_title", "Title", h.title, 'maxlength="60"')}${field("h_text", "One line", h.text, 'maxlength="200"')}</div>`;
}

function readForm(form, base) {
  const v = (n) => form.querySelector(`[name="${n}"]`)?.value || "";
  return { ...base, company: v("company"), tagline: v("tagline"), headline: v("headline"), intro: v("intro"), color: v("color"),
    phone: v("phone"), whatsapp: v("whatsapp"), email: v("email"), address: v("address"), hours: v("hours"), footer: v("footer"),
    social: Object.fromEntries([...SOCIAL, ["map"]].map(([k]) => [k, v(`s_${k}`)])),
    sections: Object.fromEntries(SECTIONS.map(([k]) => [k, !!form.querySelector(`[name="on_${k}"]`)?.checked])),
    promotions: [...form.querySelectorAll("[data-promo]")].map((r) => ({ title: r.querySelector("[name=p_title]").value, badge: r.querySelector("[name=p_badge]").value,
      text: r.querySelector("[name=p_text]").value, starts: r.querySelector("[name=p_starts]").value, ends: r.querySelector("[name=p_ends]").value,
      link: r.querySelector("[name=p_link]").value, image_id: r.querySelector("[name=p_image]").value })).filter((x) => x.title.trim()),
    highlights: [...form.querySelectorAll("[data-hl]")].map((r) => ({ title: r.querySelector("[name=h_title]").value, text: r.querySelector("[name=h_text]").value }))
      .filter((h) => h.title.trim()),
    brands: v("brands").split(",").map((b) => b.trim()).filter(Boolean),
    videos: v("videos").split(/\s+/).map((x) => x.trim()).filter(Boolean) };
}

const asDataUrl = (file) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = bad; r.readAsDataURL(file); });

async function editor(el) {
  css();
  const d = await api("/setup/page");
  let p = { ...defaults(d.business_name), ...(d.page || {}) };
  const slug = d.slug;
  const pageUrl = slug ? `${location.origin}/b/${slug}` : "";
  el.innerHTML = `<div class="page-head" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px">
      <div><h1 style="margin:0">Public page</h1><p class="muted" style="margin:4px 0 0">What customers see at your address. Choose what to show; publish when ready.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${slug ? `<a class="btn" href="${esc(pageUrl)}" target="_blank" rel="noopener">Open my page</a><button type="button" class="btn" data-copy>Copy link</button>` : ""}
        <button type="button" class="btn primary" data-publish>Publish</button></div></div>
    ${slug ? `<p class="muted small">Your address: <b>${esc(pageUrl)}</b></p>`
      : `<form class="card pe-addr" data-claim><label>Pick your address<span class="muted small">${esc(location.host)}/b/</span><input name="slug" required pattern="[a-z0-9-]{3,30}" placeholder="your-business"></label><button class="btn">Save address</button></form>`}
    <div class="pe"><form class="pe-form" novalidate>
      <fieldset><legend>What's shown</legend><div class="pe-tog">${SECTIONS.map(([k, l]) => `<label><input type="checkbox" name="on_${k}" ${(p.sections || {})[k] !== false ? "checked" : ""}> ${l}</label>`).join("")}</div></fieldset>
      <fieldset><legend>Name and look</legend><div class="pe-two">${field("company", "Name on the page", p.company, 'maxlength="80" required')}${field("tagline", "Tagline", p.tagline, 'maxlength="140"')}</div>
        ${field("headline", "Headline", p.headline, 'maxlength="160"')}<label>Introduction<textarea name="intro" rows="3" maxlength="600">${esc(p.intro || "")}</textarea></label>
        <div class="pe-two"><label>Colour<input type="color" name="color" value="${esc(p.color || "#C9A96E")}"></label>
          <label>Logo<input type="file" accept="image/*" data-logo></label></div></fieldset>
      <fieldset><legend>Offers and promotions</legend><p class="muted small" style="margin:0">The first live one is the big card at the top. Ended offers hide themselves.</p>
        <div data-promos style="display:flex;flex-direction:column;gap:10px">${(p.promotions || []).map(promoRow).join("")}</div>
        <button type="button" class="btn small" data-add-promo>+ Add an offer</button></fieldset>
      <fieldset><legend>Social and videos</legend><div class="pe-two">${SOCIAL.map(([k, l]) => field(`s_${k}`, l, (p.social || {})[k], `placeholder="${k === "website" ? "https://..." : `https://${k}.com/...`}"`)).join("")}</div>
        <label>YouTube videos (one link per line)<textarea name="videos" rows="3" placeholder="https://youtu.be/...">${esc((p.videos || []).map((v) => `https://youtu.be/${v}`).join("\n"))}</textarea></label></fieldset>
      <fieldset><legend>Contact and visit</legend><div class="pe-two">${field("phone", "Phone", p.phone)}${field("whatsapp", "WhatsApp number", p.whatsapp, 'placeholder="+91..."')}
          ${field("email", "Email", p.email, 'type="email"')}${field("hours", "Opening hours", p.hours, 'placeholder="Mon-Sat 10am-9pm"')}</div>
        <label>Address<textarea name="address" rows="2" maxlength="300">${esc(p.address || "")}</textarea></label>${field("s_map", "Map link (optional)", (p.social || {}).map, 'placeholder="https://maps.google.com/..."')}</fieldset>
      <fieldset><legend>Why choose us</legend><div data-hls style="display:flex;flex-direction:column;gap:8px">${[...(p.highlights || []), {}, {}].slice(0, 8).map(hlRow).join("")}</div></fieldset>
      <fieldset><legend>Brands and footer</legend>${field("brands", "Brands (comma separated)", (p.brands || []).join(", "))}${field("footer", "Footer line", p.footer, 'maxlength="200"')}</fieldset>
    </form><div class="pe-prev" aria-label="Preview" data-preview></div></div>`;
  const form = el.querySelector(".pe-form"), preview = el.querySelector("[data-preview]");
  const draw = () => { p = readForm(form, p); preview.innerHTML = pageHtml(p, slug, true); };
  const upload = async (file, kind) => (await run(async () => api("/setup/page/image", { method: "POST", body: { image: await asDataUrl(file), kind } })))?.image_id;
  const wire = (row) => {
    row.querySelector("[data-drop]").onclick = () => { row.remove(); draw(); };
    row.querySelector("[data-up]").onclick = () => { if (row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling); draw(); };
    row.querySelector("[data-pic]").onchange = async (e) => {
      const id = e.target.files[0] && await upload(e.target.files[0], "picture");
      if (id) { row.querySelector("[name=p_image]").value = id; row.querySelector(".pe-thumb").style.backgroundImage = `url('${media(id)}')`; draw(); }
    };
  };
  form.querySelectorAll("[data-promo]").forEach(wire);
  el.querySelector("[data-add-promo]").onclick = () => {
    const box = el.querySelector("[data-promos]");
    box.insertAdjacentHTML("beforeend", promoRow());
    wire(box.lastElementChild);
    box.lastElementChild.querySelector("input").focus();
  };
  el.querySelector("[data-logo]").onchange = async (e) => { const id = e.target.files[0] && await upload(e.target.files[0], "logo"); if (id) { p.logo_id = id; draw(); } };
  form.oninput = draw;
  form.onchange = draw;
  el.querySelector("[data-publish]").onclick = async () => {
    draw();
    if (!p.company.trim()) return toast("Give the page a name.");
    const out = await run(() => api("/setup/page", { method: "PUT", body: p }), "Published - your page is live");
    if (out) p = { ...p, ...out.page };
  };
  el.querySelector("[data-copy]")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(pageUrl); toast("Link copied"); } catch (e) { toast(pageUrl); } });
  el.querySelector("[data-claim]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await run(() => api("/setup/page/address", { method: "POST", body: { slug: new FormData(e.target).get("slug") } }), "Address saved")) editor(el);
  });
  draw();
}

export const routes = state.product.signup === "business" ? [
  { path: "/b/:slug", bare: true, render: publicPage },
  { path: "/setup/page", nav: "Public page", icon: "eye", group: "Setup", area: "#C9A96E", auth: "staff", perm: "manage_business", tenant: true, render: editor },
] : [];
