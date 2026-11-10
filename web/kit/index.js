/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// The GrepX UI kit: one import for pages (`import { KanbanBoard, kpi, html } from "/assets/kit/index.js"`).
// Every part lives in its own small file; this file only re-exports them.
export { $, $$, esc, fromHtml, h, html, Raw, raw } from "./core/dom.js";
export { Component } from "./core/component.js";
export { Emitter } from "./core/emitter.js";
export { LocalStore, MemoryStore } from "./core/local-store.js";
export { hasIcon, icon, registerIcons } from "./icons/icons.js";
export { Theme } from "./theme/theme.js";
export { ThemeToggle } from "./theme/theme-toggle.js";
export { before, DragController } from "./dnd/drag-controller.js";
export { SortableList } from "./dnd/sortable-list.js";
export { KanbanBoard } from "./board/kanban-board.js";
export { Basket } from "./basket/basket.js";
export { Builder } from "./basket/builder.js";
export { ItemPalette } from "./basket/item-palette.js";
export { DashboardGrid } from "./dashboard/dashboard-grid.js";
export { DashboardLayout, SIZES } from "./dashboard/layout.js";
export { WidgetFrame } from "./dashboard/widget-frame.js";
export { WidgetRegistry } from "./dashboard/widget-registry.js";
export { barList, columnChart } from "./charts/bar-chart.js";
export { donut } from "./charts/donut-chart.js";
export { legend, lineChart } from "./charts/line-chart.js";
export { linear, niceCeil, niceMax, short, ticks } from "./charts/scale.js";
export { sparkline } from "./charts/sparkline.js";
export { DataTable } from "./ui/data-table.js";
export { kpi, kpiRow } from "./ui/kpi.js";
export { confirm, openDialog } from "./ui/modal.js";
export { revealPasswords } from "./ui/password.js";
export { canScan, scanBarcode } from "./ui/scanner.js";
export { SignaturePad } from "./ui/signature-pad.js";
export { avatar, empty, pageHead, pill, progress, steps, tabs } from "./ui/parts.js";
