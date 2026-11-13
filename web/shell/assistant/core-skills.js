/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Skills every product gets: greetings and thanks, "what can you do", and opening any page by its name.
import { rank } from "../finder/score.js";
import { words } from "./intent.js";

export const greet = {
  id: "greet", hidden: true, words: ["hi", "hello", "hey", "morning", "afternoon", "evening", "thank", "thanks", "cheers"],
  test: (t) => (words(t).length <= 3 && /\b(hi|hello|hey|good (morning|afternoon|evening)|thanks?|thank you|cheers)\b/i.test(t) ? 0.9 : 0),
  answer: (t, ctx, me) => ({ text: /thank|cheers/i.test(t) ? "Any time! Anything else?" : `Hello ${(ctx.me().name || "").split(" ")[0]}! Ask me about your business, or pick one:`,
    chips: me.suggestions(4) }),
};

export const help = {
  id: "help", hidden: true, words: ["help", "can", "able", "skill", "question", "ask"],
  examples: ["what can you do", "help"],
  answer: (t, ctx, me) => ({ text: "I answer from your live data, and open pages for you. Try one of these, or type in your own words:",
    items: me.usable().filter((s) => !s.hidden && s.examples?.length).map((s) => ({ title: s.title || s.examples[0], sub: `"${s.examples[0]}"`, ask: s.examples[0] })) }),
};

export const open = {
  id: "open", hidden: true, words: ["open", "go", "show", "take", "page", "screen"],
  test: (t, ctx) => (/^(open|go to|goto|take me to|show me the)\b/i.test(t.trim()) && rank(target(t), pages(ctx)).length ? 0.95 : 0),
  answer: (t, ctx) => {
    const [page] = rank(target(t), pages(ctx));
    return page ? { text: `Opening ${page.title}.`, go: page.href, links: [{ label: page.title, href: page.href }] } : { text: "I can't find that page." };
  },
};

const target = (t) => t.trim().replace(/^(open|go to|goto|take me to|show me the)\s+/i, "").replace(/\s+page$/i, "");
const pages = (ctx) => ctx.pages().map((r) => ({ title: r.nav, href: `#${r.path}`, keywords: `${r.group || ""} ${r.keywords || ""}` }));

/** When nothing fits: the pages that match the words, and what to ask. */
export const fallback = {
  id: "fallback",
  answer: (t, ctx, me) => {
    const found = rank(t, pages(ctx)).slice(0, 4);
    return { text: found.length ? "I'm not sure what you mean - is it one of these pages? Or try a question below." : "I don't know that one yet. Here is what I can answer:",
      links: found.map((p) => ({ label: p.title, href: p.href })), chips: me.suggestions(5), fresh: false };
  },
};

export const CORE = [greet, help, open];
