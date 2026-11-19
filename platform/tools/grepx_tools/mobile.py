# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

"""The product's Android app (APK), built on this Linux server - one command, any product.

    scripts/run.sh apk                        the app opens http://<this server's IP>:<the site's port>
    scripts/run.sh apk https://app.myco.sg    the app opens that address (use your HTTPS domain once you have one)
    scripts/run.sh apk tools                  only install the build tools (Node 22, Java 21, Android SDK)

The app is a native shell (Capacitor) around the product's own web app: name, colour and icon come from product.json,
every page and feature is the web's, so a server update reaches the app at once - rebuild only for a new address,
name or icon. Output: build/mobile/<product>.apk - phones download it from the site itself: http://<site>/app.apk. The address is kept in .env (MOBILE_URL); the build tools live in ~/android-sdk.
Release signing for Google Play: put MOBILE_KEYSTORE, MOBILE_KEYSTORE_PASSWORD and MOBILE_KEY_ALIAS in .env."""
from __future__ import annotations

import configparser
import json
import os
import re
import shutil
import socket
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from log import say  # noqa: E402
from root import ROOT  # noqa: E402

CAPACITOR = "8"
SDK = Path(os.environ.get("ANDROID_HOME") or Path.home() / "android-sdk")
CMDLINE_URL = os.environ.get("ANDROID_CMDLINE_URL", "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip")
PACKAGES = ["platform-tools", "platforms;android-36", "build-tools;36.0.0"]
OUT = ROOT / "build" / "mobile"


def sh(cmd: str, cwd: Path | None = None, env: dict | None = None) -> None:
    say("INFO", "apk", cmd if len(cmd) < 160 else cmd[:157] + "...")
    if subprocess.call(cmd, shell=True, cwd=cwd, env={**os.environ, **(env or {})}) != 0:
        raise SystemExit(f"failed: {cmd}")


def has(cmd: str, pattern: str) -> bool:
    """The command runs and its version output matches."""
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return re.search(pattern, r.stdout + r.stderr) is not None


def tools() -> dict:
    """Node 22+, Java 21 and the Android SDK - each installed only when missing. Returns the build environment."""
    root = "" if os.geteuid() == 0 else "sudo "
    if not has("node --version", r"v(2[2-9]|[3-9]\d)\."):
        sh(f"curl -fsSL https://deb.nodesource.com/setup_22.x | {root}bash - && {root}apt-get install -y nodejs")
    if not has("javac -version", r"javac (2[1-9]|[3-9]\d)"):
        sh(f"{root}apt-get update -qq && {root}apt-get install -y openjdk-21-jdk-headless unzip")
    manager = SDK / "cmdline-tools" / "latest" / "bin" / "sdkmanager"
    if not manager.exists():
        (SDK / "cmdline-tools").mkdir(parents=True, exist_ok=True)
        sh(f"curl -fsSL -o tools.zip '{CMDLINE_URL}' && unzip -q -o tools.zip && rm -rf latest && mv cmdline-tools latest && rm tools.zip",
           cwd=SDK / "cmdline-tools")
    env = {"ANDROID_HOME": str(SDK), "ANDROID_SDK_ROOT": str(SDK)}
    java = subprocess.run("readlink -f $(which javac)", shell=True, capture_output=True, text=True).stdout.strip()
    if java:
        env["JAVA_HOME"] = str(Path(java).parent.parent)
    if not (SDK / "platforms" / "android-36").exists():
        sh(f"yes | '{manager}' --licenses > /dev/null && '{manager}' " + " ".join(f"'{p}'" for p in PACKAGES), env=env)
    say("OK", "apk", f"build tools ready (Android SDK in {SDK})")
    return env


def product() -> dict:
    """name, id, colour and logo of this product, from its product.json."""
    found = sorted((ROOT / "apps").glob("*/product.json")) + sorted((ROOT / "apps").glob("*/*/product.json"))
    p = json.loads(found[0].read_text(encoding="utf-8")) if found else {}
    name = p.get("name") or ROOT.name
    slug = re.sub(r"[^a-z0-9]", "", name.lower().replace("grepx", "")) or "app"
    return {"name": name.replace("GrepX ", ""), "slug": slug, "id": f"sg.grepx.{slug}", "colour": (p.get("theme") or {}).get("primary", "#2563eb"),
            "logo": p.get("logo", "")}


def site_url() -> str:
    """http://<this server's public IP>:<the first port of the product's site (the *-bff in services.ini)>."""
    ini = configparser.ConfigParser()
    ini.read(ROOT / "config" / "services.ini")
    bff = next((s for s in ini.sections() if s.endswith("-bff") and ini[s].getboolean("enabled", True)), None)
    port = (ini[bff].get("ports", "8080") if bff else "8080").split("-")[0].strip()
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    return f"http://{ip}:{port}"


def remember(url: str) -> None:
    path = ROOT / ".env"
    lines = [x for x in (path.read_text(encoding="utf-8").splitlines() if path.exists() else []) if not x.startswith("MOBILE_URL=")]
    path.write_text("\n".join([*lines, f"MOBILE_URL={url}"]) + "\n", encoding="utf-8")


def loading_page(p: dict, url: str) -> str:
    """Shown for a moment while the app opens the site - and with a Try again button when the server cannot be reached."""
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{p['name']}</title><style>body{{margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;
background:{p['colour']};color:#fff;text-align:center}}.l{{font-size:64px}}button{{margin-top:18px;padding:12px 22px;border:0;border-radius:12px;
font-size:16px;font-weight:600;color:{p['colour']};background:#fff}}</style></head><body><div><div class="l">{p['logo']}</div><h2>{p['name']}</h2>
<p id="m">Opening…</p><button id="b" hidden onclick="location.href='{url}'">Try again</button></div>
<script>location.href='{url}';setTimeout(function(){{document.getElementById('m').textContent='Cannot reach the server - check the internet connection.';
document.getElementById('b').hidden=false}},8000)</script></body></html>"""


def icon_svg(p: dict) -> str:
    letter = (p["name"][:1] or "A").upper()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">'
            f'<stop offset="0" stop-color="{p["colour"]}"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#g)"/>'
            f'<text x="512" y="540" font-size="560" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="middle" '
            f'font-family="DejaVu Sans,Liberation Sans,Arial,sans-serif">{letter}</text></svg>')


def project(p: dict, url: str, env: dict) -> Path:
    """build/mobile/<slug>: the Capacitor project (made once, refreshed every build)."""
    app = OUT / p["slug"]
    (app / "www").mkdir(parents=True, exist_ok=True)
    (app / "assets").mkdir(exist_ok=True)
    if not (app / "package.json").exists():
        (app / "package.json").write_text(json.dumps({"name": f"{p['slug']}-app", "private": True, "version": "1.0.0"}, indent=2), encoding="utf-8")
        sh(f"npm install --no-audit --no-fund @capacitor/core@{CAPACITOR} @capacitor/android@{CAPACITOR} @capacitor/cli@{CAPACITOR}", cwd=app)
    (app / "www" / "index.html").write_text(loading_page(p, url), encoding="utf-8")
    config = {"appId": p["id"], "appName": p["name"], "webDir": "www",
              "server": {"url": url, **({"cleartext": True} if url.startswith("http://") else {})},
              "android": {"allowMixedContent": url.startswith("http://")}}
    (app / "capacitor.config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    if not (app / "android").exists():
        sh("npx cap add android", cwd=app, env=env)
    icons(app, p, env)
    sh("npx cap sync android", cwd=app, env=env)
    props = app / "android" / "gradle.properties"
    text = props.read_text(encoding="utf-8")
    if "-Xmx2048m" not in text:                    # fits beside the running services on a small server
        props.write_text(re.sub(r"org\.gradle\.jvmargs=.*", "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8", text), encoding="utf-8")
    return app


def icons(app: Path, p: dict, env: dict) -> None:
    """The app icon and splash in the product's colour (a missing font or tool only leaves Android's default icon)."""
    (app / "assets" / "icon.svg").write_text(icon_svg(p), encoding="utf-8")
    try:
        sh("npm ls sharp >/dev/null 2>&1 || npm install --no-audit --no-fund sharp @capacitor/assets", cwd=app)
        sh("node -e \"require('sharp')('assets/icon.svg').png().toFile('assets/icon-only.png')\"", cwd=app)
        sh(f"npx capacitor-assets generate --android --iconBackgroundColor '{p['colour']}' --splashBackgroundColor '{p['colour']}'", cwd=app, env=env)
    except SystemExit as exc:
        say("WARN", "apk", f"icon not made ({exc}) - the app keeps the default icon")


def signing() -> dict:
    e = {**dotenv(), **os.environ}
    keys = ("MOBILE_KEYSTORE", "MOBILE_KEYSTORE_PASSWORD", "MOBILE_KEY_ALIAS")
    return {k: e[k] for k in keys} if all(e.get(k) for k in keys) else {}


def build(app: Path, p: dict, env: dict) -> Path:
    sign = signing()
    task = "assembleRelease" if sign else "assembleDebug"
    extra = ("" if not sign else f" -Pandroid.injected.signing.store.file='{sign['MOBILE_KEYSTORE']}' -Pandroid.injected.signing.store.password='{sign['MOBILE_KEYSTORE_PASSWORD']}'"
             f" -Pandroid.injected.signing.key.alias='{sign['MOBILE_KEY_ALIAS']}' -Pandroid.injected.signing.key.password='{sign['MOBILE_KEYSTORE_PASSWORD']}'")
    sh(f"chmod +x gradlew && ./gradlew --no-daemon -q {task}{extra}", cwd=app / "android", env=env)
    kind = "release" if sign else "debug"
    built = next((app / "android" / "app" / "build" / "outputs" / "apk" / kind).glob("*.apk"))
    target = OUT / f"{p['slug']}.apk"
    shutil.copy2(built, target)                    # the site serves it at /app.apk
    return target


def dotenv() -> dict:
    from workspace import dotenv as read
    return read()


def main(args: list[str]) -> int:
    env = tools()
    if args[:1] == ["tools"]:
        return 0
    p = product()
    url = (args[0] if args else "") or dotenv().get("MOBILE_URL") or site_url()
    if not re.match(r"^https?://", url):
        raise SystemExit(f"'{url}' is not an address - e.g. scripts/run.sh apk https://app.myco.sg")
    remember(url.rstrip("/"))
    if url.startswith("http://"):
        say("WARN", "apk", "plain http: pages work, but phones allow GPS, camera and notifications only on https - use your https domain when you have one")
    app = project(p, url.rstrip("/"), env)
    apk = build(app, p, env)
    size = apk.stat().st_size / 1e6
    say("OK", "apk", f"{p['name']} app ready: {apk} ({size:.1f} MB) - opens {url}")
    say("OK", "apk", f"on a phone: open {url.rstrip('/')}/app.apk and install it (allow 'Install unknown apps')")
    say("OK", "apk", f"to your PC: scp root@<server>:{apk} .")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
