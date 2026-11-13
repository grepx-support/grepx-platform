/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The assistant's brain (chain of responsibility): every skill the person may use rates the question, the best one
// answers; nothing fits -> the fallback offers what it can do. Answers are cached a short while. A skill is
//   { id, title, words: [...], examples: [...], perm?, test?(text) -> 0..1, answer(text, ctx) -> reply }
// and a reply is { text, kpis?: [{label, value, tone?, href?}], items?: [{title, sub?, value?, tone?, href?}],
//   chips?: [question...], links?: [{label, href}], go?: href } (go = open that page at once).
import { TtlCache } from "./cache.js";
import { context } from "./context.js";
import { fit } from "./intent.js";

const ENOUGH = 0.34;

export class Assistant {
  constructor(skills, fallback) {
    this.cache = new TtlCache();
    Object.assign(this, { skills, fallback, ctx: context(this.cache) });
  }

  usable() { return this.skills.filter((s) => !s.perm || this.ctx.can(s.perm)); }

  /** [{skill, score}] best first. */
  rate(text) {
    return this.usable().map((skill) => ({ skill, score: skill.test ? skill.test(text, this.ctx) : fit(text, skill) }))
      .filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  }

  async answer(text) {
    const key = `answer:${text.trim().toLowerCase()}`;
    const hit = this.cache.get(key);
    if (hit) return { ...hit, cached: true };
    const [best] = this.rate(text);
    const skill = best && best.score >= ENOUGH ? best.skill : this.fallback;
    let reply;
    try {
      reply = await skill.answer(text, this.ctx, this);
    } catch (e) {
      return { text: `I couldn't get that just now (${e.message || "error"}). Try again in a moment.`, tone: "bad" };
    }
    return this.cache.set(key, { ...reply, skill: skill.id }, reply.fresh === false ? 5 : 45);
  }

  /** Example questions for the person, from the skills they may use. */
  suggestions(n = 6) {
    return this.usable().filter((s) => s.examples?.length && !s.hidden).slice(0, n).map((s) => s.examples[0]);
  }

  forget() { this.cache.clear(); }
}
