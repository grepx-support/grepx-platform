// Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
// This file is part of the GrepX platform and is proprietary and confidential.
// Unauthorised copying, use, modification or distribution is strictly prohibited.

// R-8: is the committed bundle what the sources build? A product's test calls staleFiles(); [] = up to date.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildProduct } from "./build.mjs";

const list = (dir, base = dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [])
  .flatMap((e) => (e.isDirectory() ? list(path.join(dir, e.name), base) : [path.relative(base, path.join(dir, e.name)).replace(/\\/g, "/")])).sort();

export async function staleFiles({ esbuild, root, out }) {
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "grepx-react-"));
  try {
    await buildProduct({ esbuild, root, out: fresh });
    const have = list(out), want = list(fresh);
    const differ = want.filter((f) => !have.includes(f) || fs.readFileSync(path.join(out, f), "utf8") !== fs.readFileSync(path.join(fresh, f), "utf8"));
    return [...differ, ...have.filter((f) => !want.includes(f)).map((f) => `${f} (not built any more)`)];
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
  }
}
