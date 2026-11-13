/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The chat window: a glowing button bottom-right, a panel with the conversation (kept for this browser tab), a typing
// indicator, suggestion chips and the box to type in. Ctrl+J (or Cmd+J) opens and closes it.
import { html, icon } from "../../kit/index.js";
import { replyView } from "./view.js";

const KEY = "assistant.chat";
const kept = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || "[]"); } catch (e) { return []; } };
const keep = (log) => { try { sessionStorage.setItem(KEY, JSON.stringify(log.slice(-40))); } catch (e) { /* storage unavailable */ } };

export class ChatPanel {
  constructor(brain, { name = "Assistant", greeting = "Hi! Ask me anything about your business." } = {}) {
    Object.assign(this, { brain, name, greeting, log: kept() });
    this.el = document.createElement("div");
    this.el.className = "as-root";
    this.el.innerHTML = html`<button type="button" class="as-fab" aria-label="Open the assistant (Ctrl+J)" title="Ask me (Ctrl+J)">${icon("sparkle", { size: 24 })}</button>
      <section class="as-panel" role="dialog" aria-label="${name}" hidden>
        <header><span class="as-av">${icon("sparkle", { size: 18 })}</span><div><b>${name}</b><small>Answers from your live data</small></div>
          <button type="button" class="kit-iconbtn small" data-clear title="New conversation" aria-label="New conversation">${icon("refresh", { size: 15 })}</button>
          <button type="button" class="kit-iconbtn small" data-close aria-label="Close">${icon("x", { size: 16 })}</button></header>
        <div class="as-log" aria-live="polite"></div>
        <form class="as-ask"><input name="q" autocomplete="off" placeholder="Ask about your business…" aria-label="Your question">
          <button class="as-send" aria-label="Send">${icon("send", { size: 17 })}</button></form></section>`.text;
    this.panel = this.el.querySelector(".as-panel");
    this.list = this.el.querySelector(".as-log");
    this.input = this.el.querySelector("input");
    this.wire();
  }

  wire() {
    this.el.querySelector(".as-fab").onclick = () => this.toggle();
    this.el.querySelector("[data-close]").onclick = () => this.toggle(false);
    this.el.querySelector("[data-clear]").onclick = () => { this.log = []; keep(this.log); this.brain.forget(); this.paint(); };
    this.el.querySelector("form").onsubmit = (e) => { e.preventDefault(); this.ask(this.input.value); };
    this.list.addEventListener("click", (e) => {
      const ask = e.target.closest("[data-ask]");
      if (ask) this.ask(ask.dataset.ask);
      else if (e.target.closest("a[href^='#']") && innerWidth < 760) this.toggle(false);
    });
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); this.toggle(); }
      if (e.key === "Escape" && !this.panel.hidden) this.toggle(false);
    });
  }

  toggle(show = this.panel.hidden) {
    this.panel.hidden = !show;
    this.el.classList.toggle("open", show);
    if (!show) return;
    if (!this.log.length) this.log.push({ who: "bot", reply: { text: this.greeting, chips: this.brain.suggestions(6) } });
    this.paint();
    this.input.focus();
  }

  paint(thinking = false) {
    const fresh = this.log.length - (thinking ? 1 : 2);                        // only the newest messages slide in
    this.list.innerHTML = this.log.map((m, i) => {
      const bubble = m.who === "me" ? `<div class="as-me">${html`${m.text}`.text}</div>` : String(replyView(m.reply));
      return i < fresh ? bubble.replace(/class="as-(me|reply)/, 'class="as-old as-$1') : bubble;
    }).join("") + (thinking ? '<div class="as-typing"><i></i><i></i><i></i></div>' : "");
    this.list.scrollTop = this.list.scrollHeight;
  }

  async ask(text) {
    const q = String(text || "").trim();
    if (!q) return;
    this.input.value = "";
    this.log.push({ who: "me", text: q });
    this.paint(true);
    const [reply] = await Promise.all([this.brain.answer(q), new Promise((r) => setTimeout(r, 380))]);   // a beat to "think"
    this.log.push({ who: "bot", reply });
    keep(this.log);
    this.paint();
    if (reply.go) location.hash = reply.go;
  }
}
