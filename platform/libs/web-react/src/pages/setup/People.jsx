/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */
// Shared Setup tab (every product), first written for FleetWise.
// Users (add one, change their role) and roles (what each role may do)
import { Avatar, Password } from "../../kit.jsx";
import { post, values } from "./common.jsx";

export function Users({ s, redraw }) {
  const add = async (e) => {
    e.preventDefault();
    const v = values(e.target);
    if (await post("/setup/users", { name: v.name, email: v.email, phone: v.phone, password: v.password, staff_role: v.role }, "User added")) redraw();
  };
  return (
    <>
      <section className="card"><ul className="k-sort">{s.users.map((u) => (
        <li key={u.id}><span></span><Avatar name={u.name} photo={u.photo_id} size={40} /><span className="who"><b>{u.name}</b><small>{u.email}</small></span>
          <select aria-label={`Role of ${u.name}`} defaultValue={u.staff_role_id || ""} onChange={(e) => post(`/setup/users/${u.id}/role`, { staff_role: e.target.value }, "Role changed")}>
            <option value="">-</option>{s.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></li>))}</ul></section>
      <form className="card accent k-section" onSubmit={add}><h2>Add a user</h2>
        <div className="row"><label>Name<input name="name" required /></label><label>Email (login)<input name="email" type="email" required /></label>
          <label>Phone<input name="phone" required placeholder="+91 98765 43210" /></label><label>Password (8+)<Password name="password" minLength={8} required /></label>
          <label>Role<select name="role">{s.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
        <p><button className="btn primary">Add user</button></p></form>
    </>
  );
}

export function Roles({ s, redraw }) {
  const save = (r) => async (e) => {
    e.preventDefault();
    const perms = [...e.target.querySelectorAll("input:checked")].map((i) => i.value);
    if (await post(`/setup/roles/${encodeURIComponent(r.id)}`, { perms }, "Role saved")) redraw();
  };
  return (
    <div className="grid two">{s.roles.map((r) => (
      <form className="card accent" key={r.id} onSubmit={save(r)}><h2>{r.name}</h2>
        <div className="k-perms">{s.permissions.map((p) => (
          <label className="check" key={p.id}><input type="checkbox" value={p.id} defaultChecked={(r.perms || []).includes(p.id)} /> {p.label || p.id}</label>))}</div>
        <p><button className="btn">Save</button></p></form>))}</div>
  );
}
