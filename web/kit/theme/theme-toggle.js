/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The sun / moon button that switches the theme.
import { Component } from "../core/component.js";
import { html } from "../core/dom.js";
import { icon } from "../icons/icons.js";

export class ThemeToggle extends Component {
  /** props: { theme: Theme } */
  render() {
    const dark = this.props.theme.current() === "dark";
    return html`<button type="button" class="kit-iconbtn" aria-label="${dark ? "Switch to light theme" : "Switch to dark theme"}"
      title="${dark ? "Light theme" : "Dark theme"}">${icon(dark ? "sun" : "moon")}</button>`;
  }

  mounted() {
    this.el.onclick = () => this.props.theme.toggle();
    this.onCleanup(this.props.theme.on("change", () => this.update()));
  }
}
