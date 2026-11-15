/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// "Send how?" - the channels to tick before something goes out (email / WhatsApp / SMS), the PDF attached.
import { html, openDialog } from "/assets/kit/index.js";

const ALL = [["email", "Email"], ["whatsapp", "WhatsApp"], ["sms", "SMS"]];

/** Resolves to the ticked channels, or null when cancelled. */
export async function pickChannels({ title, text, ticked = ["email", "whatsapp"], offer = ["email", "whatsapp", "sms"] }) {
  const form = document.createElement("div");
  form.innerHTML = String(html`<p class="muted">${text}</p>
    ${ALL.filter(([k]) => offer.includes(k)).map(([k, t]) => html`<label class="check"><input type="checkbox" value="${k}" ${ticked.includes(k) ? "checked" : ""}> ${t}</label>`)}
    <p class="muted small">The PDF goes with it: attached to the email, as a document on WhatsApp. Without a provider set up it is only written to the outbox.</p>`);
  if (await openDialog({ title, body: form, actions: [{ label: "Back", value: "" }, { label: "Send", value: "send", primary: true }] }) !== "send") return null;
  const channels = [...form.querySelectorAll("input:checked")].map((i) => i.value);
  return channels.length ? channels : null;
}
