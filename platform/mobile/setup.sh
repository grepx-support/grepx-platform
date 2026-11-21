#!/usr/bin/env bash
# Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
# This file is part of the GrepX platform and is proprietary and confidential.
# Unauthorised copying, use, modification or distribution is strictly prohibited.

# Prepares a product's phone app (its apps/mobile folder) around the shared package grepx_app - once, and again
# after a Flutter upgrade. A product's own apps/mobile/setup.sh calls this with its app name:
#   bash ../../platform/mobile/setup.sh grepx_blood "LifeFlow"
# It generates the android/ and ios/ shells, sets the permissions (internet, camera, notifications), turns on what
# the notification library needs (Java 8+ API desugaring), keeps Gradle at 3 GB (WSL kills 8 GB builds), fetches packages.
# Then:  flutter run --dart-define=API_BASE=https://your.domain.com
#        flutter build apk --release --dart-define=API_BASE=https://your.domain.com
set -euo pipefail
NAME="${1:?usage: setup.sh <project_name> [\"App label\"]}"
LABEL="${2:-$NAME}"

say() { printf '%s %-5s [%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "mobile" "$2"; }
die() { say ERROR "$1"; exit 1; }

command -v flutter >/dev/null 2>&1 || die "Flutter is not installed - see https://docs.flutter.dev/get-started/install"
[ -f pubspec.yaml ] || die "run from the product's apps/mobile folder"
[ -d ../../platform/mobile/grepx_app ] || die "platform/ is not linked in - run ./workspace.sh in the product repo first"

if [ ! -d android ]; then
  say INFO "generating the android/ and ios/ shells (first time)"
  flutter create --org sg.grepx --project-name "$NAME" --platforms=android,ios . >/dev/null || die "flutter create failed"
fi

M=android/app/src/main/AndroidManifest.xml
for perm in INTERNET CAMERA POST_NOTIFICATIONS VIBRATE; do
  grep -q "permission.$perm\"" "$M" || sed -i.bak "/<manifest/a\    <uses-permission android:name=\"android.permission.$perm\"/>" "$M"
done
sed -i.bak "s|android:label=\"[^\"]*\"|android:label=\"$LABEL\"|" "$M"

P=ios/Runner/Info.plist
grep -q NSCameraUsageDescription "$P" || sed -i.bak "0,/<dict>/s|<dict>|<dict>\n\t<key>NSCameraUsageDescription</key>\n\t<string>Scan QR codes and barcodes</string>|" "$P"
/usr/bin/env perl -0pi -e "s|(<key>CFBundleDisplayName</key>\s*<string>)[^<]*(</string>)|\${1}$LABEL\${2}|" "$P" 2>/dev/null || true

# flutter_local_notifications needs core library desugaring on Android
for G in android/app/build.gradle.kts android/app/build.gradle; do
  [ -f "$G" ] || continue
  if ! grep -q "desugar_jdk_libs" "$G"; then
    if [[ "$G" == *.kts ]]; then
      sed -i.bak "/compileOptions {/a\        isCoreLibraryDesugaringEnabled = true" "$G"
      printf '\ndependencies {\n    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")\n}\n' >> "$G"
    else
      sed -i.bak "/compileOptions {/a\        coreLibraryDesugaringEnabled true" "$G"
      printf "\ndependencies {\n    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'\n}\n" >> "$G"
    fi
  fi
done

G=android/gradle.properties
JVM="${GRADLE_JVMARGS:--Xmx3g -XX:MaxMetaspaceSize=1g -XX:ReservedCodeCacheSize=256m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8}"
[ -f "$G" ] && sed -i.bak "s|^org.gradle.jvmargs=.*|org.gradle.jvmargs=$JVM|" "$G"
find android ios -name '*.bak' -delete 2>/dev/null || true

say INFO "fetching packages"
flutter pub get >/dev/null || die "flutter pub get failed"
say OK "$LABEL ready - flutter run --dart-define=API_BASE=https://your.domain.com"
