/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// AI chat, ChatGPT-style, in every business product: your own conversations on the left, the thread on the right,
// answers that know this business's data and this product's words (ai-service; the free local model unless the
// server has a paid key). Answers take a moment on the local model: the thread shows the AI thinking, then the answer.
import { api, run, state } from "../../app.js";
import { html, icon, raw } from "../../kit/index.js";

const SUGGEST = {
  default: ["How is business this month?", "What needs my attention today?", "Which items sell best?", "Write a WhatsApp offer for my customers"],
};

/** Light formatting of an answer: paragraphs, bullet lines, **bold**, numbers kept as written (text escaped first). */
function rich(text) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const lines = esc(String(text || "")).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").split("\n");
  let out = "", list = false;
  for (const l of lines) {
    const item = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (item) { if (!list) { out += "<ul>"; list = true; } out += `<li>${item[1]}</li>`; continue; }
    if (list) { out += "</ul>"; list = false; }
    if (l.trim()) out += `<p>${l}</p>`;
  }
  return out + (list ? "</ul>" : "");
}

async function page(el, q) {
  const chats = await api("/ai/chats").catch(() => ({ chats: [] }));
  const current = q.id || "";
  el.classList.add("ch-page");
  document.body.classList.add("on-chat");             // the floating assistant button would cover Send
  const off = () => { if (!location.hash.startsWith("#/chat")) { document.body.classList.remove("on-chat"); el.classList.remove("ch-page"); window.removeEventListener("hashchange", off); } };
  window.addEventListener("hashchange", off);
  el.innerHTML = String(html`<div class="ch">
    <aside class="ch-side"><a class="btn primary ch-new" href="#/chat">${icon("plus", { size: 16 })} New chat</a>
      <nav class="ch-list">${chats.chats.map((c) => html`<a class="${c.chat_id === current ? "on" : ""}" href="#/chat?id=${c.chat_id}">${icon("message", { size: 14 })}<span>${c.title}</span>${c.thinking ? html`<i class="ch-dot"></i>` : ""}</a>`)}</nav>
      <p class="ch-model muted small">${icon("sparkle", { size: 13 })} ${chats.model || "AI"}</p></aside>
    <section class="ch-main"><div class="ch-thread" aria-live="polite"></div>
      <form class="ch-box"><textarea name="m" rows="1" placeholder="Message the AI about your business…" autocomplete="off"></textarea>
        <button class="ch-send" aria-label="Send">${icon("send", { size: 18 })}</button></form>
      <p class="ch-note muted small">AI can be wrong - check numbers that matter. It answers from this business's data.</p></section></div>`);
  const thread = el.querySelector(".ch-thread"), form = el.querySelector(".ch-box"), box = form.m;
  let id = current, polling = 0;
  const draw = (c) => {
    if (!c || !c.messages.length) {
      const sug = SUGGEST[state.product?.id] || state.product?.ai?.suggestions || SUGGEST.default;
      thread.innerHTML = String(html`<div class="ch-empty"><div class="ch-logo">${icon("sparkle", { size: 30 })}</div><h2>How can I help today?</h2>
        <div class="ch-sugs">${sug.map((s) => html`<button type="button" class="ch-sug">${s}</button>`)}</div></div>`);
      return;
    }
    thread.innerHTML = String(html`${c.messages.map((m) => html`<div class="ch-msg ${m.role}"><div class="ch-av">${m.role === "user" ? icon("user", { size: 16 }) : icon("sparkle", { size: 16 })}</div>
        <div class="ch-bubble">${m.failed ? html`<p class="bad">${m.failed}</p>` : raw(m.role === "user" ? rich(m.content) : rich(m.content))}</div></div>`)}
      ${c.thinking ? html`<div class="ch-msg assistant"><div class="ch-av">${icon("sparkle", { size: 16 })}</div><div class="ch-bubble ch-typing"><i></i><i></i><i></i></div></div>` : ""}`);
    thread.scrollTop = thread.scrollHeight;
  };
  const load = async () => {
    if (!id) return draw(null);
    const c = await api(`/ai/chats/${id}`).catch(() => null);
    draw(c);
    clearTimeout(polling);
    if (c && c.thinking && location.hash.startsWith("#/chat")) polling = setTimeout(load, 1500);
  };
  const send = async (text) => {
    if (!text.trim()) return;
    const mine = { role: "user", content: text };
    thread.querySelector(".ch-empty")?.remove();
    thread.insertAdjacentHTML("beforeend", String(html`<div class="ch-msg user"><div class="ch-av">${icon("user", { size: 16 })}</div><div class="ch-bubble">${raw(rich(mine.content))}</div></div>
      <div class="ch-msg assistant"><div class="ch-av">${icon("sparkle", { size: 16 })}</div><div class="ch-bubble ch-typing"><i></i><i></i><i></i></div></div>`));
    thread.scrollTop = thread.scrollHeight;
    const r = await run(() => api("/ai/chat", { method: "POST", body: { chat_id: id, message: text } }));
    if (!r) return load();
    if (!id) { location.hash = `#/chat?id=${r.chat_id}`; return; }      // a new chat: the page again, with it in the list
    load();
  };
  form.onsubmit = (e) => { e.preventDefault(); const t = box.value; box.value = ""; box.style.height = ""; send(t); };
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  box.addEventListener("input", () => { box.style.height = "auto"; box.style.height = `${Math.min(box.scrollHeight, 200)}px`; });
  thread.addEventListener("click", (e) => { const s = e.target.closest(".ch-sug"); if (s) send(s.textContent); });
  el.querySelector(".ch-list").addEventListener("click", async (e) => {
    const a = e.target.closest("a");
    if (a && e.altKey) { e.preventDefault(); if (await run(() => api(`/ai/chats/${new URLSearchParams(a.hash.split("?")[1]).get("id")}`, { method: "DELETE" }), "Chat deleted")) location.hash = "#/chat"; }
  });
  if (q.ask) send(q.ask); else load();
  box.focus();
}

export const routes = [
  { path: "/chat", nav: "AI chat", key: "i", icon: "sparkle", auth: "staff", tenant: true, area: "ai",
    keywords: "ai chat chatgpt assistant ask question gpt llm conversation", render: page },
];
