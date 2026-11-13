/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Starts the assistant for signed-in people: the core skills plus the skills each product module exports
// (`export const skills = [...]`). Generic - products add what it knows by adding skills, nothing else; its name and
// first words come from product.json ("assistant": {"name", "greeting"}).
import { state } from "../state.js";
import { onSessionChange } from "../session.js";
import { CORE, fallback } from "./core-skills.js";
import { Assistant } from "./engine.js";
import { ChatPanel } from "./panel.js";

export function startAssistant(modules) {
  const brain = new Assistant([...modules.flatMap((m) => m.skills || []), ...CORE], fallback);
  const chat = new ChatPanel(brain, state.product?.assistant || {});
  document.body.append(chat.el);
  const show = () => { chat.el.hidden = !(state.me && state.me.tenant); if (chat.el.hidden) chat.toggle(false); brain.forget(); };
  onSessionChange(show);
  show();
  return chat;
}
