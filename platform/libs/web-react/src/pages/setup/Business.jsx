/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Setup -> Business, the same tab in every product: name, currency, time zone, invoice details; tax; AI. A product adds its
// own settings sections and how they are read from the form:
//   <Business s={s} redraw={redraw} noun="Organisation" aiText="..." Sections={MarketsSettings} settings={(v) => ({ ... })} />
import { useState } from "react";
import { resetBiz } from "/assets/modules/business/lib/business.js";
import { Icon } from "../../kit.jsx";
import { RegionField } from "../../regions.jsx";
import { api, run } from "../../shell.js";
import { values } from "./common.jsx";

const COUNTRIES = [["IN", "India - GST (CGST + SGST / IGST)"], ["SG", "Singapore - GST"], ["OTHER", "Other - one tax"]];
const none = () => null;

export function Business({ s, redraw, noun = "Company", aiText = "", Sections = none, settings = () => ({}) }) {
  const b = s.business, t = b.tax || {}, st = b.settings || {}, bill = b.billing || {};
  const [country, setCountry] = useState(t.country);
  const submit = async (e) => {
    e.preventDefault();
    const v = values(e.target);
    const body = { name: v.name, currency: v.currency.toUpperCase(), timezone: v.timezone, tax: { country: v.country, region: v.region || "", tax_number: v.tax_number },
      settings: { ...settings(v), ai_enabled: !!v.ai_enabled, ai_monthly_limit: Number(v.ai_monthly_limit || 0) },
      billing: { legal_name: v.legal_name, address: v.address, payment_note: v.payment_note } };
    if (await run(() => api("/setup/business", { method: "PATCH", body }), "Saved")) { resetBiz(); redraw(); }
  };
  return (
    <form className="grid two" onSubmit={submit}>
      <section className="card accent"><h2><Icon name="building" /> {noun}</h2><label>Name<input name="name" defaultValue={b.name} required /></label>
        <div className="row"><label>Currency<input name="currency" defaultValue={b.currency} maxLength={3} required /></label><label>Time zone<input name="timezone" defaultValue={b.timezone} required /></label></div>
        <label>Legal name (on invoices)<input name="legal_name" defaultValue={bill.legal_name || ""} /></label><label>Address<textarea name="address" rows={2} defaultValue={bill.address || ""} /></label>
        <label>How to pay (bank, PayNow / UEN - printed on invoices)<textarea name="payment_note" rows={2} defaultValue={bill.payment_note || ""} /></label></section>
      <section className="card accent" style={{ "--area": "#16a34a" }}><h2><Icon name="receipt" /> Tax</h2>
        <label>Country<select name="country" value={country || "OTHER"} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map(([c, n]) =>
          <option key={c} value={c}>{n}</option>)}</select></label>
        <div><RegionField key={country} country={country} value={country === t.country ? t.region : ""} /></div>
        <label>Tax number (GSTIN / GST reg. no.)<input name="tax_number" defaultValue={t.tax_number || ""} placeholder="29ABCDE1234F1Z5" /></label>
        <p className="muted small">In India, a sale inside your state carries CGST + SGST, and to another state IGST - worked out on every invoice from the customer's state.</p></section>
      <Sections b={b} st={st} />
      <section className="card accent" style={{ "--area": "#4f46e5" }}><h2><Icon name="sparkle" /> AI</h2>
        <p className="muted small">{aiText}</p>
        <label className="check"><input type="checkbox" name="ai_enabled" defaultChecked={st.ai_enabled !== false} /> AI on</label>
        <div className="row"><label>AI answers a month<input name="ai_monthly_limit" type="number" min="0" defaultValue={st.ai_monthly_limit ?? 300} /></label></div></section>
      <p><button className="btn primary">Save</button></p></form>
  );
}
