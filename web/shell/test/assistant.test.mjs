/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The assistant's understanding (words, fit, subject) and its cache.
import assert from "node:assert/strict";
import test from "node:test";
import { TtlCache } from "../assistant/cache.js";
import { fit, stem, subject, words } from "../assistant/intent.js";

const LOW = { words: ["low", "short", "below", "minimum", "out", "running"], examples: ["what is low on stock", "what is running out"] };
const OWED = { words: ["owe", "owed", "overdue", "unpaid"], examples: ["who owes us money"] };

test("words drop small words and trim endings", () => {
  assert.deepEqual(words("What's RUNNING low on stock?"), ["run", "low", "stock"]);
  assert.equal(stem("batches"), "batche");
  assert.equal(stem("deliveries"), "delivery");
  assert.equal(stem("spilled"), "spill");
});

test("fit picks the skill a question is about", () => {
  assert.ok(fit("whats low on stock", LOW) > 0.8);
  assert.equal(fit("whats low on stock", OWED), 0);
  assert.ok(fit("who owes us", OWED) > fit("who owes us", LOW));
  assert.equal(fit("", LOW), 0);
});

test("subject is what is left after the skill's words", () => {
  assert.equal(subject("how much paneer do we have", { words: ["much", "have"], examples: ["how much rice do we have"] }), "paneer");
});

test("the cache keeps values for a while and shares one promise", async () => {
  const c = new TtlCache(2);
  let made = 0;
  const make = () => { made += 1; return Promise.resolve(made); };
  assert.equal(await c.wrap("a", 60, make), 1);
  assert.equal(await c.wrap("a", 60, make), 1);
  c.set("b", 2); c.set("c", 3);                         // over the limit: the oldest goes
  assert.equal(c.get("a"), undefined);
  c.set("d", 4, -1);
  assert.equal(c.get("d"), undefined);                  // expired
});
