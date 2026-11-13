/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Understanding a question well enough to pick a skill: words (lower case, plural / -ing / -ed trimmed, small words
// dropped), then a score per skill from the words it listens for and its example questions. Pure.
const SMALL = new Set("a an the is are was were be to of in on at for and or me my our we us you it this that what whats which who how do does did can could i please show tell give any have has".split(" "));

const undouble = (w) => (w.length > 2 && w.at(-1) === w.at(-2) && !"ls".includes(w.at(-1)) ? w.slice(0, -1) : w);

export function stem(w) {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) return undouble(w.slice(0, -3));
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export const words = (text) => String(text || "").toLowerCase().replace(/['’]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w && !SMALL.has(w)).map(stem);

/** 0..1: how well `text` fits a skill { words: [...], examples: [...] }; whole listened-for words count most. */
export function fit(text, skill) {
  const asked = words(text);
  if (!asked.length) return 0;
  const listen = new Set((skill.words || []).flatMap(words));
  const hits = asked.filter((w) => listen.has(w)).length;
  const best = Math.max(0, ...(skill.examples || []).map((ex) => {
    const e = new Set(words(ex));
    return asked.filter((w) => e.has(w)).length / Math.max(e.size, asked.length);
  }));
  return Math.min(1, hits / asked.length * 0.7 + best * 0.6);
}

/** The words of `text` left after removing the ones a skill listens for - usually the thing asked about ("paneer"). */
export const subject = (text, skill) => {
  const listen = new Set([...(skill.words || []), ...(skill.examples || [])].flatMap(words));
  return words(text).filter((w) => !listen.has(w)).join(" ");
};
