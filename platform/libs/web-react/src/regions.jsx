/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// Indian states and union territories with their GST state codes (the first two digits of a GSTIN).
export const IN_STATES = [["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"], ["05", "Uttarakhand"],
  ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"], ["12", "Arunachal Pradesh"],
  ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"], ["18", "Assam"], ["19", "West Bengal"],
  ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"], ["24", "Gujarat"], ["26", "Dadra and Nagar Haveli and Daman and Diu"],
  ["27", "Maharashtra"], ["29", "Karnataka"], ["30", "Goa"], ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"],
  ["35", "Andaman and Nicobar Islands"], ["36", "Telangana"], ["37", "Andhra Pradesh"], ["38", "Ladakh"]];

export const stateName = (code) => (IN_STATES.find(([c]) => c === code) || [null, code || ""])[1];

/** A <select> of states for India; a free text box elsewhere. */
export function RegionField({ country, value = "", name = "region", label = "State" }) {
  if (country !== "IN") return <label>Region (optional)<input name={name} defaultValue={value} maxLength={4} /></label>;
  return (
    <label>{label}<select name={name} defaultValue={value}><option value="">-</option>
      {IN_STATES.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select></label>
  );
}
