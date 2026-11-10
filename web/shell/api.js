/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The API client: bearer token, JSON in and out, errors carry the server's reason and trace id.
import { state } from "./state.js";
import { toast } from "./toast.js";

const listeners = { unauthorized: () => {} };
/** session.js tells the client what to do when the token is no longer valid (log out) - no import cycle. */
export const onUnauthorized = (fn) => { listeners.unauthorized = fn; };

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (state.session) headers.Authorization = `Bearer ${state.session.token}`;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api/v1${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const trace = res.headers.get("X-Trace-Id");
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) {
    const d = data.detail || {};
    if (res.status === 401 && state.session) listeners.unauthorized();
    const err = new Error(d.message || "Something went wrong");
    err.reason = d.reason; err.trace = trace; err.status = res.status;
    throw err;
  }
  return data;
}

/** Run an action, show a toast when done (or the error with its trace id); returns the result or undefined. */
export async function run(fn, done) {
  try {
    const r = await fn();
    if (done) toast(done);
    return r;
  } catch (e) {
    toast(`${e.message}${e.trace ? `  (trace ${e.trace.slice(0, 12)})` : ""}`);
    return undefined;
  }
}
