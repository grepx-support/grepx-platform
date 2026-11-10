/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Base class of every kit component: props in, one root element out, re-render on update, cleanup on destroy.
import { fromHtml, Raw } from "./dom.js";

export class Component {
  constructor(props = {}) {
    this.props = props;
    this.el = null;
    this.cleanups = [];
  }

  /** Subclasses return an Element, or markup (Raw/string) for one element. */
  render() { throw new Error(`${this.constructor.name}.render() is missing`); }

  /** Called after every render, with this.el in the page: wire events here. */
  mounted() {}

  build() {
    const out = this.render();
    return out instanceof Node ? out : fromHtml(out instanceof Raw ? out.text : out);
  }

  mount(target) {
    this.el = this.build();
    target.replaceChildren(this.el);
    this.mounted();
    return this;
  }

  /** Mount next to other content instead of replacing it. */
  appendTo(target) {
    this.el = this.build();
    target.append(this.el);
    this.mounted();
    return this;
  }

  update(patch = {}) {
    Object.assign(this.props, patch);
    this.release();
    const next = this.build();
    this.el?.replaceWith(next);
    this.el = next;
    this.mounted();
    return this;
  }

  /** Register cleanup (listeners on window, controllers) to run before the next render or on destroy. */
  onCleanup(fn) { this.cleanups.push(fn); }

  release() {
    this.cleanups.splice(0).forEach((fn) => fn());
  }

  destroy() {
    this.release();
    this.el?.remove();
    this.el = null;
  }
}
