/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Shared by every GrepX product's React screens (@grepx/web-react); first written for FleetWise (plan/security-react-migration).
// The kit's page pieces as components with the same elements and class names (R-6), so business.css and fleetwise.css apply as is.
import { useRef, useState } from "react";
import { avatar, donut, icon, sparkline } from "/assets/kit/index.js";
import { Markup, markup } from "./markup.jsx";

/** An icon, drawn by the kit and turned into an element (no HTML string reaches the page). */
export function Icon({ name, size = 18, label = "" }) {
  return <>{markup(icon(name, { size, label }))}</>;
}

/** The page header: icon, title, subtitle and actions, coloured by its area. */
export function PageHead({ title, subtitle = "", icon: name = "dot", area = "", actions = null }) {
  return (
    <header className="kit-phead" style={area ? { "--area": area } : undefined}>
      <span className="kit-picon"><Icon name={name} size={26} /></span>
      <div><h1>{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>
      <div className="kit-pactions">{actions}</div>
    </header>
  );
}

export const Pill = ({ children, tone = "" }) => <span className={`kit-pill ${tone}`}>{children}</span>;

export function Empty({ icon: name = "sparkle", title, text = "", action = null }) {
  return <div className="kit-empty"><Icon name={name} size={40} /><h3>{title}</h3>{text ? <p>{text}</p> : null}{action}</div>;
}

/** Section tabs: [{id, href, label, icon}] and the id that is on. */
export function Tabs({ list, current }) {
  return (
    <nav className="kit-tabs" aria-label="Sections">
      {list.map((t) => (
        <a key={t.id} href={t.href} className={t.id === current ? "on" : ""} aria-current={t.id === current ? "page" : undefined}>
          {t.icon ? <Icon name={t.icon} size={16} /> : null}{t.label}
        </a>
      ))}
    </nav>
  );
}

export function Kpi({ label, value, icon: name = "dot", area = "", note = "", tone = "", trend = null, href = "" }) {
  const body = (
    <>
      <span className="kit-kpi-icon"><Icon name={name} size={20} /></span>
      <span className="kit-kpi-label">{label}</span><strong className={`kit-kpi-value ${tone}`}>{value}</strong>
      {note ? <small className="kit-kpi-note">{note}</small> : null}{trend ? <Markup of={sparkline(trend, { color: "var(--area)" })} /> : null}
    </>
  );
  const style = area ? { "--area": area } : undefined;
  return href ? <a className="kit-kpi" href={href} style={style}>{body}</a> : <div className="kit-kpi" style={style}>{body}</div>;
}

export const KpiRow = ({ items }) => <div className="kit-kpis">{items.map((k, i) => <Kpi key={i} {...k} />)}</div>;

export const Avatar = ({ name = "", ...opts }) => <Markup of={avatar(name, opts)} />;
export const Donut = (props) => <Markup of={donut(props)} />;

/** A password box with the kit's "show password" eye (the shell adds it to legacy pages after they draw; a React page draws its own). */
export function Password(props) {
  const box = useRef(null);
  const [shown, setShown] = useState(false);
  return (
    <span className="kit-reveal">
      <input {...props} type={shown ? "text" : "password"} ref={box} data-reveal="" />
      <button type="button" className="kit-iconbtn small" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={String(shown)}
        onClick={() => { setShown(!shown); box.current?.focus(); }}><Icon name={shown ? "eyeoff" : "eye"} size={16} /></button>
    </span>
  );
}
