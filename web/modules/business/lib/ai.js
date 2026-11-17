/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// AI answers are jobs (a model can take a while): wait for one, checking every few seconds, up to a few minutes.
import { api } from "../../../shell/api.js";      // not app.js: the shell imports this too

export async function waitForJob(jobId, { every = 1500, max = 180 } = {}) {
  const until = Date.now() + max * 1000;
  while (Date.now() < until) {
    const j = await api(`/ai/jobs/${jobId}`).catch(() => null);
    if (j && j.state !== "thinking") return j;
    await new Promise((r) => setTimeout(r, every));
  }
  return { state: "failed", answer: "", why: "The AI is taking too long - try again in a minute." };
}
