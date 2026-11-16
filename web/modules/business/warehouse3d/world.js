/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The 3D warehouse put together: building, racks, cartons, tags, beacons, forklift, highlights, camera moves and
// picking. The page talks to it only through the methods below.
import { Stage, THREE } from "../lib/three/stage.js";
import { BAY, pickRoute } from "./plan.js";
import { Route } from "./route.js";
import { materials } from "./look.js";
import { Racks } from "./racks.js";
import { building } from "./floor.js";
import { tag } from "../lib/three/labels.js";
import { Highlights, beacons } from "./effects.js";
import { Flight } from "../lib/three/flight.js";
import { Picker } from "../lib/three/picker.js";
import { forklift } from "./forklift.js";

const SEVERITY = { bad: 0, warn: 1, info: 2, good: 3, none: 4 };

export class Warehouse3D {
  constructor(host, plan, { onPick = () => {}, onHover = () => {} } = {}) {
    const stage = this.stage = new Stage(host), mats = materials(stage.dark);
    Object.assign(this, { plan, onPick, mode: "expiry", focus: null, chosen: null, touring: null });
    stage.fit(plan.size.w, plan.size.d);
    this.racks = new Racks(plan, mats);
    this.racks.paint(this.mode);
    this.fx = new Highlights(stage, mats);
    this.flight = new Flight(stage);
    stage.scene.add(building(plan, mats), this.racks.group, beacons(stage, this.racks, mats), this.fx.group, this.tags());
    const truck = forklift(stage, plan);
    if (truck) stage.scene.add(truck);
    new Picker(stage, this.racks.hits, {
      hover: (id, e) => { const entry = this.racks.bins.get(id); this.fx.show("hover", entry); onHover(entry?.bay || null, e); },
      pick: (id) => this.select(id),
    });
    stage.controls.addEventListener("start", () => this.tour(false));
    const r = this.reach();
    stage.camera.position.set(r * 1.4, r * 1.6, r * 1.9);
    this.home(2.2);
    this.racks.dropIn(stage);
  }

  tags() {
    const g = new THREE.Group();
    for (const { bay, size } of this.racks.bins.values()) {
      const t = tag(bay.code, bay.floor ? 0.3 : 0.34, { bg: bay.floor ? "rgba(14,116,144,.9)" : "rgba(15,23,42,.88)" });
      t.position.set(bay.x, size[1] + 0.28, bay.z + (bay.floor ? 0 : BAY.d / 2));
      g.add(t);
    }
    return g;
  }

  reach() { return Math.max(this.plan.size.w, this.plan.size.d) * 0.42 + 4.5; }

  home(seconds = 1.2) { const r = this.reach(); return this.flight.to([0, 0.8, 0], [r * 0.5, r * 0.55, r * 0.7], seconds); }

  top() { return this.flight.to([0, 0, 0], [0, this.reach() * 2.1, 0.01], 1.2); }

  /** Choose a bin (or null): outline it, fly to it, tell the page (unless `tell` is false). */
  select(id, fly = true, tell = true) {
    const entry = id === null ? null : this.racks.bins.get(id);
    this.chosen = entry ? id : null;
    this.fx.show("chosen", entry);
    if (entry && fly) {
      const { x, z } = entry.bay;
      this.flight.to([x, 1.4, z], [x + 3.6, 4.6, z + 7.4], 1.1);
    }
    if (tell) this.onPick(entry?.bay || null);
  }

  setMode(mode) { this.mode = mode; this.racks.paint(mode, this.focus); }

  /** Fade every bin not in `ids` (a Set) - or show all again with null. */
  setFocus(ids) { this.focus = ids; this.racks.paint(this.mode, ids); }

  spin(on) { this.stage.controls.autoRotate = on; }

  /** Draw a pick list's walk (or none with null); the bins on it stay lit, the rest fade. Returns the stops in order. */
  showRoute(pick) {
    this.route?.remove();
    this.route = null;
    if (!pick) { this.setFocus(null); return []; }
    const walk = pickRoute(pick, this.plan);
    this.route = new Route(this.stage, walk, (bay) => this.racks.bins.get(bay.id)?.size[1] ?? BAY.h);
    this.stage.scene.add(this.route.group);
    this.setFocus(new Set(walk.stops.map((s) => s.bay.id)));
    const r = this.reach();
    this.flight.to([0, 0, 0], [r * 0.15, r * 1.9, r * 1.15], 1.2);
    return walk.stops;
  }

  snapshot() { return this.stage.snapshot(); }

  /** Visit the bins that need attention first, one every few seconds, until stopped. */
  tour(on) {
    clearInterval(this.touring);
    this.touring = null;
    if (!on) return;
    const stops = [...this.racks.bins.values()].map((x) => x.bay).filter((b) => b.lots.length)
      .sort((a, z) => SEVERITY[a.tone] - SEVERITY[z.tone]).map((b) => b.id);
    if (!stops.length) return;
    let i = 0;
    const next = () => { if (!this.stage.host.isConnected) return this.tour(false); this.select(stops[i++ % stops.length]); };
    next();
    this.touring = setInterval(next, 3600);
  }
}
