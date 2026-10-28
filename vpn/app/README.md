# Orvane — Android app

Flutter UI + Kotlin WireGuard engine. See [`../README.md`](../README.md) for the whole system and its status.

```
lib/
  app/            router (go_router), shell with floating nav, app root
  core/
    design/       tokens, Inter typography, theme, glass components, page scaffold, dialogs
    motion/       TiltScope: gyroscope parallax with spring smoothing and reduced-motion support
    net/          API client · config/ build-time config · format helpers
  features/
    home/         dashboard + ConnectionSphere (shader in shaders/sphere.frag)
    vpn/          VpnController (handshake-gated state machine), engine channel, provisioning, routing policy
    servers/      inventory, on-device latency probe, locations + detail screens
    auth/ account/ subscription/ settings/ insights/ support/ onboarding/
android/app/src/main/kotlin/app/orvane/vpn/tunnel/
  KeyVault        Keystore-encrypted device key
  TunnelSpec      validated, secret-free tunnel parameters
  TunnelManager   GoBackend lifecycle, watchdog, network monitor, always-on restart
  VpnChannel      platform channels + VPN consent
tool/design_gallery.dart   design-review harness (not part of the app)
```

## Configure and run

```bash
cp config/example.json config/dev.json    # fill in your values
flutter pub get
flutter run --dart-define-from-file=config/dev.json
```

All values are public by design (the Supabase anon key is meant to ship in clients). Without them the app still runs and says plainly that the service isn't configured.

## Checks

```bash
flutter analyze
flutter test                      # state machine, routing policy, honest-failure widget test
```

Visual review of every sphere state in a browser (no device needed):

```bash
flutter build web -t tool/design_gallery.dart --no-web-resources-cdn -o build/gallery
# serve build/gallery and open ?state=disconnected|connecting|connected|reconnecting|error
```

Release builds: see [`../docs/release.md`](../docs/release.md).
