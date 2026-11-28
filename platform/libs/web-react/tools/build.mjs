// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

// The one way every product builds its React screens (R-8): esbuild, ESM, code split, /assets/* left to the browser (the shell
// and the kit it already has), minified, written into apps/web/modules/react/ and COMMITTED - servers never need Node.
// React is resolved from the product's node_modules, also for this package's files, so a page has one React; the product
// hands in its own esbuild (this package has no node_modules of its own).
import { readdirSync, rmSync } from "node:fs";
import path from "node:path";

/** buildProduct({ esbuild, root: <apps/web-src>, out: <apps/web/modules/react> }) - entries are src/entries/*.jsx, one per legacy module. */
export async function buildProduct({ esbuild, root, out }) {
  const entries = readdirSync(path.join(root, "src/entries")).filter((f) => /\.jsx?$/.test(f)).sort().map((f) => `src/entries/${f}`);
  rmSync(out, { recursive: true, force: true });
  await esbuild.build({
    entryPoints: entries, outdir: out, bundle: true, splitting: true, format: "esm", platform: "browser", target: ["es2022"],
    jsx: "automatic", minify: true, external: ["/assets/*"], legalComments: "none", charset: "utf8", logLevel: "warning",
    entryNames: "[name]", chunkNames: "chunks/[name]-[hash]", define: { "process.env.NODE_ENV": '"production"' }, absWorkingDir: root,
    nodePaths: [path.join(root, "node_modules")], preserveSymlinks: true,
  });
}
