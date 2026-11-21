# The shared phone app (Flutter, iOS + Android)

Every GrepX product's phone app is one small Flutter app in the product's repo (`apps/mobile`) on top of the shared
package here, `grepx_app`. Common things live once, here; a product adds only its own screens.

| Here (`grepx_app`) | In the product (`apps/mobile/lib/<product>/`) |
|---|---|
| look: iOS-style theme from one brand colour, dark mode, iOS page transitions on Android too | `product.dart`: name, logo, colour, tabs |
| shell: floating frosted tab bar, large titles, pull to refresh, bell + account | its screens |
| sign-in (+ an `afterSignIn` hook), session (token, role, permissions, product JSON), `/me` profile | `notices`: what is worth telling |
| API client with trace ids, offline message | |
| notifications: the server inbox (`/me/inbox`, the web's bell) + the product's notices, banner in front, phone notification behind | |
| widgets: cards, grouped lists, stat tiles, count-up numbers, rings, sparklines, bar charts, touch line charts (fl_chart), skeletons, empty/error states, segmented control, slide to confirm, banners, confirm sheets | |
| shared screens: tasks, signed-in web page (every other feature) | |

Open source used: fl_chart (MIT), flutter_animate (BSD), flutter_local_notifications (BSD), plus http,
shared_preferences, qr_flutter, mobile_scanner, url_launcher, webview_flutter.

## A product's app

```
apps/mobile/
  pubspec.yaml        grepx_app: {path: ../../platform/mobile/grepx_app}
  setup.sh            exec bash ../../platform/mobile/setup.sh grepx_<product> "<App name>"
  lib/main.dart       void main() => runGrepx(<product>Product);
  lib/<product>/      product.dart + screens
```

`platform/` is linked into the product repo by `./workspace.sh`. Then, in `apps/mobile`:

```
./setup.sh                                                           # once: android/ios shells, permissions, packages
flutter run --dart-define=API_BASE=https://your.domain.com
flutter build apk --release --dart-define=API_BASE=https://your.domain.com
```

Each product repo's `.github/workflows/mobile.yml` builds the APK on every push (it checks out grepx-platform next
to the product, as the workspace does).

## Notifications

The app's bell shows the platform inbox (what notification-service sends on the "app" channel - the same as the web's
bell) and what the product finds worth telling (a booking tomorrow, an order to receive, a pickup in 30 minutes). New
ones drop in as a banner while the app is open and as a phone notification when it is in the background. Messages
while the app is fully closed need push from the server (Firebase Cloud Messaging) - the next step.
