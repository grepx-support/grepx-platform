/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// An investor's statement: open the PDF, or send it to them by email / WhatsApp with the PDF attached.
import { api, run } from "/assets/app.js";
import { html, icon } from "/assets/kit/index.js";
import { pickChannels } from "../lib/channels.js";
import { openPdf } from "../lib/pdf.js";

export const statementActions = (p) => html`<span class="fd-st"><a href="javascript:void 0" data-st="${p.party_id}" title="Statement PDF">${icon("printer", { size: 13 })}</a>
  <a href="javascript:void 0" data-st-send="${p.party_id}" data-name="${p.name}" title="Send the statement">${icon("send", { size: 13 })}</a></span>`;

export async function statementClick(e) {
  const pdf = e.target.closest("[data-st]"), send = e.target.closest("[data-st-send]");
  if (pdf) return openPdf(`/funds/parties/${pdf.dataset.st}/statement`);
  if (!send) return;
  const channels = await pickChannels({ title: `Send ${send.dataset.name} their statement`, ticked: ["email"], text: "Everything they put in, got back and their share, in every fund, to today." });
  if (channels) await run(() => api(`/funds/parties/${send.dataset.stSend}/statement/send`, { method: "POST", body: { channels } }), "Statement sent");
}
