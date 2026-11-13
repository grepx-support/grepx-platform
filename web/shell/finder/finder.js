/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The finder (command palette): one box that searches every source at once; arrows + Enter to go, Esc to close.
// It only shows and navigates - what can be found is up to the sources it is given.
import { html, icon } from "../../kit/index.js";

export class Finder {
  /** sources: [PageSource, ...]; recent: RecentSource (remembers what was opened) */
  constructor(sources, recent) {
    Object.assign(this, { sources, recent, items: [], at: 0, asked: 0 });
    this.hint = `Search ${sources.map((s) => s.group.toLowerCase()).filter((g) => g !== "recent").join(", ")}…`;
  }

  open() {
    if (this.el) return this.input.focus();
    this.el = document.createElement("div");
    this.el.className = "kit-finder";
    this.el.innerHTML = String(html`<div class="kit-findbox" role="dialog" aria-label="Search">
      <label>${icon("search", { size: 20 })}<input placeholder="${this.hint}" aria-label="Search" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></label>
      <div class="kit-findlist" role="listbox"></div><footer><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>?</kbd> shortcuts</span></footer></div>`);
    document.body.append(this.el);
    this.input = this.el.querySelector("input");
    this.list = this.el.querySelector(".kit-findlist");
    this.el.onclick = (e) => { if (e.target === this.el) this.close(); };
    this.input.oninput = () => this.search();
    this.input.onkeydown = (e) => this.key(e);
    this.list.onclick = (e) => { const n = e.target.closest("[data-n]")?.dataset.n; if (n !== undefined) this.go(Number(n)); };
    requestAnimationFrame(() => { this.el.classList.add("on"); this.input.focus(); });
    this.search();
  }

  close() {
    this.el?.remove();
    this.el = null;
  }

  async search() {
    const query = this.input.value, ask = ++this.asked;
    const found = await Promise.all(this.sources.map(async (s) => ({ group: s.group, items: await s.find(query) })));
    if (ask !== this.asked || !this.el) return;                  // a newer search already answered
    this.items = found.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));
    this.at = 0;
    this.draw(found.filter((g) => g.items.length));
  }

  draw(groups) {
    let n = 0;
    this.list.innerHTML = groups.length ? String(html`${groups.map((g) => html`<div class="kit-findgroup">${g.group}</div>${g.items.map((it) => {
      const i = n++;
      return html`<button type="button" class="kit-finditem ${i === this.at ? "on" : ""}" data-n="${i}" role="option" style="${it.area ? `--area:${it.area}` : ""}">
        <span class="ni">${icon(it.icon || "dot", { size: 16 })}</span><b>${it.title}</b><small>${it.hint || ""}</small>${it.key ? html`<kbd>G ${it.key.toUpperCase()}</kbd>` : ""}</button>`; })}`)}`)
      : String(html`<p class="kit-findnone">Nothing found for “${this.input.value}”</p>`);
  }

  key(e) {
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (move) {
      e.preventDefault();
      this.at = (this.at + move + this.items.length) % Math.max(1, this.items.length);
      this.list.querySelectorAll("[data-n]").forEach((b) => b.classList.toggle("on", Number(b.dataset.n) === this.at));
      this.list.querySelector(".on")?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); this.go(this.at); }
    else if (e.key === "Escape") this.close();
  }

  go(n) {
    const it = this.items[n];
    if (!it) return;
    this.recent.remember({ title: it.title, hint: it.hint, href: it.href, icon: it.icon, area: it.area });
    this.close();
    location.hash = it.href;
  }
}
