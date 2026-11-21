# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The page lists every module the app imports at start (fetched at once, not a layer at a time) and carries
product.json; dynamic imports are left to load when needed; a broken list never breaks the page."""
import json

from grepx_bff.app import WebBuild, module_graph


def tree(tmp_path):
    web, prod = tmp_path / "web", tmp_path / "prod"
    (web / "kit").mkdir(parents=True)
    (prod / "modules" / "lib").mkdir(parents=True)
    (web / "index.html").write_text('<head></head><script type="module" src="/assets/app.js"></script>')
    (web / "app.js").write_text('import { a } from "/assets/kit/index.js";\nimport "./kit/side.js";\nconst q = () => import("/assets/kit/later.js");')
    (web / "kit" / "index.js").write_text('export { b } from "./b.js";\nexport const a = 1;')
    (web / "kit" / "b.js").write_text("export const b = 2;")
    (web / "kit" / "side.js").write_text("")
    (web / "kit" / "later.js").write_text("")
    (prod / "modules" / "jobs.js").write_text('import { x } from "./lib/x.js";\nimport { a } from "/assets/kit/index.js";')
    (prod / "modules" / "lib" / "x.js").write_text("export const x = 1;")
    (prod / "product.json").write_text(json.dumps({"name": "Fleet </script>", "modules": ["fleet/jobs"]}))
    return web, prod, {"/assets/modules/fleet/": prod / "modules", "/assets/": web}


def test_every_module_the_app_starts_with_and_nothing_loaded_later(tmp_path):
    web, prod, mounts = tree(tmp_path)
    found = module_graph(["/assets/app.js", "/assets/modules/fleet/jobs.js"], mounts)
    assert found == ["/assets/app.js", "/assets/modules/fleet/jobs.js", "/assets/kit/index.js", "/assets/kit/side.js",
                     "/assets/modules/fleet/lib/x.js", "/assets/kit/b.js"]


def test_the_page_preloads_them_and_carries_the_product(tmp_path):
    web, prod, mounts = tree(tmp_path)
    page = WebBuild([web, prod], mounts, lambda: prod / "product.json").index(web / "index.html")
    assert page.count('rel="modulepreload"') == 6 and '/assets/v/' in page.split('modulepreload" href="')[1][:12]
    assert "window.GREPX_PRODUCT" in page and "</script>\"" not in page and "<\\/script>" in page
    broken = WebBuild([web, prod], mounts, lambda: prod / "missing.json").index(web / "index.html")
    assert "modulepreload" not in broken and 'src="/assets/v/' in broken           # the slow way, but a page
