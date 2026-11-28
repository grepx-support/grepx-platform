# @grepx/web-react

The React layer every GrepX product's screens use, inside the shared shell (the shell keeps routing, sign-in, session and the kit).

| File | What |
| --- | --- |
| `src/mount.js` | `mountRoute(el, Component, props)`: a React tree in the element the shell gives a route; unmounted when that element leaves the page |
| `src/kit.jsx` | The kit's page pieces with the same elements and class names: `PageHead`, `Icon`, `Pill`, `Empty`, `Tabs`, `Kpi`, `KpiRow`, `Avatar`, `Donut`, `Password` |
| `src/hooks.jsx` | `useLoad`, `Loaded` (skeleton, the shell's load-error card, retry), `useArea` |
| `src/DataTable.jsx` | The kit's table: sort, filter, pages, rows that open |
| `src/markup.jsx` | The kit's trusted markup (icons, sparklines) as elements: no `dangerouslySetInnerHTML` anywhere |
| `src/shell.js` | `api`, `can`, `run`, `state`, `toast`, dialogs and drawers from `/assets/...` (one session, one toast) |
| `src/drawer.jsx`, `src/download.js`, `src/native.js` | A kit drawer with a React body; an authenticated download; the native change event |
| `tools/build.mjs` | `buildProduct({root, out})`: the one build (esbuild, committed output) |
| `tools/eslint.mjs` | `grepxReact(...)`: the lint rules (no HTML strings, no `javascript:`, hooks) |
| `tools/bundle.mjs` | `staleFiles({root, out})`: the committed bundle is what the sources build |

The per-route switch (`react` or `legacy`, `?engine=legacy` in one tab) is `web/kit/engine.js`, served with the shell.

A product: `apps/web-src/` with `"@grepx/web-react": "file:../../platform/libs/web-react"`, `src/entries/<module>.jsx`, and
`apps/web/modules/migration.js` = `makeEngine("<product>", FLAGS)`. Tests of this package run from a product: `npm run test:shared`.
