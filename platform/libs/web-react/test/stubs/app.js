/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// A stand-in for the shell's app.js in unit tests: a fake api the tests script, the toast and the session state.
import { vi } from "vitest";

export const api = vi.fn(async () => ({}));
export const run = vi.fn(async (fn, done) => { const r = await fn(); if (done) toast(done); return r; });
export const toast = vi.fn();
export const state = { product: { areas: {} }, session: { token: "t" }, me: { perms: ["*"] }, routes: [] };
export const can = vi.fn(() => true);
export const store = { get: vi.fn(), set: vi.fn() };
export const enterSupport = vi.fn();
export const esc = (v) => String(v ?? "");
