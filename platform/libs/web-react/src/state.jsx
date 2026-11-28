/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The platform's six state words (roadmap §1c): every screen that shows the state of something says it the same way -
// words and an icon, never colour alone, with the reason on hover. Unknown words are shown as "unknown", never as healthy.
import { Icon } from "./kit.jsx";

export const STATES = {
  healthy: ["Healthy", "check", "good"],
  degraded: ["Degraded", "alert", "warn"],
  failed: ["Failed", "x", "bad"],
  unavailable: ["Unavailable", "minus", "bad"],
  unknown: ["Unknown", "info", "muted"],
  stale: ["Stale", "clock", "warn"],
};

/** state: one of STATES; why: the reason (hover and screen readers). */
export function StateBadge({ state, why = "" }) {
  const key = STATES[state] ? state : "unknown";
  const [label, icon, tone] = STATES[key];
  return <span className={`kit-state ${tone}`} data-state={key} title={why || label}><Icon name={icon} size={12} />{label}{why ? <span className="sr-only"> - {why}</span> : null}</span>;
}
