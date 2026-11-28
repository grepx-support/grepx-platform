/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The icons-only menu: the class on the page and the button's pressed state and words follow the choice.
import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMini } from "../mini.js";

test("the icons-only menu is applied to the page and its button", () => {
  const classes = new Set(), attrs = {};
  const root = { classList: { toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) } };
  const button = { setAttribute: (k, v) => { attrs[k] = v; } };
  applyMini(true, root, button);
  assert.ok(classes.has("nav-mini"));
  assert.equal(attrs["aria-pressed"], "true");
  assert.match(attrs["aria-label"], /names/);
  applyMini(false, root, button);
  assert.ok(!classes.has("nav-mini"));
  assert.equal(attrs["aria-pressed"], "false");
});
