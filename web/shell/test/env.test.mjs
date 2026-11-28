/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The environment badge: the usual names in words with a tone, anything else as written, nothing when unset.
import assert from "node:assert/strict";
import { test } from "node:test";
import { envBadge } from "../env.js";

test("environment names become a labelled badge", () => {
  assert.equal(envBadge("prod").label, "Production");
  assert.equal(envBadge("PRODUCTION").tone, "bad");
  assert.deepEqual([envBadge("staging").tone, envBadge("uat").label], ["warn", "Staging"]);
  assert.deepEqual([envBadge("dev").label, envBadge("local").tone], ["Development", "good"]);
  assert.deepEqual(envBadge("demo-asia"), { label: "demo-asia", tone: "info", icon: "info" });
  assert.equal(envBadge(""), null);
  assert.equal(envBadge(undefined), null);
});
