# Release builds and signing

## 1. Create the upload key (You, once)

Google Play App Signing holds the real app signing key; you sign uploads with an **upload key**.

```bash
keytool -genkeypair -v -keystore ~/orvane-upload.jks -keyalg RSA -keysize 4096 \
        -validity 10000 -alias orvane-upload
```

Keep the keystore and its passwords in a password manager **and** an offline backup. Never commit them. If the upload key is lost, Play Console support can reset it; if you opted out of Play App Signing and lose the key, you can never update the app.

## 2. Point Gradle at it

Create `vpn/app/android/key.properties` (already git-ignored):

```properties
storeFile=/home/you/orvane-upload.jks
storePassword=...
keyAlias=orvane-upload
keyPassword=...
```

`android/app/build.gradle.kts` reads this file. Without it, release builds are produced **unsigned** on purpose (the template's "sign release with the debug key" was removed).

In CI, write `key.properties` and the keystore from secrets at build time and delete them afterwards.

## 3. Version and build the App Bundle

`pubspec.yaml` → `version: 1.0.0+1` (name + build number). Increase the build number for every upload.

```bash
cd vpn/app
flutter build appbundle --release \
  --dart-define-from-file=config/prod.json \
  --obfuscate --split-debug-info=build/symbols
```

Output: `build/app/outputs/bundle/release/app-release.aab`. Keep `build/symbols` for each release to symbolicate crash stack traces.

Release build properties already configured:

* R8 minification and resource shrinking, with keep rules for WireGuard's JNI classes (`android/app/proguard-rules.pro`)
* `minSdk 24` (WireGuard tunnel library requirement), target SDK from Flutter
* HTTPS-only network security config, system CAs only
* No backups / device transfer of app data
* Portrait-only activity

## 4. Before every upload

```bash
flutter analyze && flutter test
cd ../backend && npm test
```

Then run the Phase 6 device checklist in [setup.md](setup.md#5-phase-6-acceptance-test-on-a-real-phone) against the build you are about to upload, on at least one Android 8–10 device and one Android 14+ device.

## 5. Not yet verified

The Android build itself has **not** been run in the environment this project was created in (the Android SDK download host was blocked). The first `flutter build appbundle` on your machine is the first real Android build; expect to fix toolchain-level issues (SDK/NDK versions, Gradle plugin compatibility) there.
