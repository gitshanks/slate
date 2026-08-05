# Slate native apps

Slate now has real native foundations for both platforms:

- `ios/`: SwiftUI, Google Sign-In, Keychain-backed sessions, and a GRDB offline library cache. Sign in with Apple is prepared server-side but hidden until an Apple Developer Program membership is active.
- `android/`: Jetpack Compose, Google Credential Manager, Android Keystore-backed sessions, Room offline cache, and Android share-intent intake.
- `app/api/v1/`: a versioned account API shared by both clients.
- `contracts/openapi.yaml`: the checked-in wire contract for the native clients.

This first milestone signs in against the existing Slate account, restores the session across launches, loads cached data immediately, refreshes from Neon, and renders native Watchlist, Watching, Watched, Lists, and Profile screens. Library mutations, title search, drag-to-reorder, full title pages, and the shared-link resolver are the next feature-parity milestone.

## Backend setup

Add the native identity and device-session tables to the hosted database:

```bash
npm run db:migrate:native
```

Then set these values in Vercel for Production, Preview, and Development as appropriate:

```dotenv
NATIVE_AUTH_SECRET=<a new random secret of at least 32 bytes>
NATIVE_AUTH_ISSUER=https://s1ate.space
GOOGLE_IOS_CLIENT_ID=<the iOS OAuth client ID>
GOOGLE_ANDROID_CLIENT_ID=<the Android OAuth client ID>
APPLE_BUNDLE_ID=space.s1ate.app
APPLE_SERVICE_ID=<optional web Services ID>
```

Keep `AUTH_GOOGLE_ID` configured for the website. The native API accepts tokens issued to the web, iOS, or Android client IDs, so each native app can use its own platform client without sharing the web client configuration.

Device access tokens expire after 15 minutes. Refresh tokens expire after 90 days, are stored only as hashes in Neon, and rotate on every refresh. Revoking a device session does not sign the account out of the website or another phone.

## Google Cloud setup

Use the existing Google Cloud project so web, iOS, and Android identities share one OAuth consent screen.

1. Keep the Web application client and its `https://www.s1ate.space/api/auth/callback/google` redirect URI for Auth.js.
2. Create an iOS OAuth client with bundle ID `space.s1ate.app`. A paid Apple membership is not required for this Google credential. Slate's current client is already checked into `ios/project.yml`; Google OAuth client IDs are public identifiers, not secrets:

   ```yaml
   GOOGLE_IOS_CLIENT_ID: 712869496808-nounasfl9qtcsdjesijtmk25eptvo416.apps.googleusercontent.com
   GOOGLE_REVERSED_CLIENT_ID: com.googleusercontent.apps.712869496808-nounasfl9qtcsdjesijtmk25eptvo416
   GOOGLE_SERVER_CLIENT_ID: ""
   ```

   The optional server client ID can stay blank. In that configuration Google issues an ID token for the iOS client, and Slate verifies it against `GOOGLE_IOS_CLIENT_ID` on the backend.

3. Create an Android OAuth client with package `space.s1ate.app` and the SHA-1 certificate fingerprint for every signing key used by the app. The current Android client is `712869496808-0khtoe6grb5pgupuk8affo53ici0509p.apps.googleusercontent.com`, and the current debug/emulator certificate is `1C:74:09:59:F4:BC:AD:1D:73:50:D1:A7:67:B8:16:AA:1B:7A:3E:AA`. Add the Play App Signing SHA-1 before production.

   Credential Manager requests its ID token using the Web client ID, not the Android client ID. Slate's current Web client is `712869496808-kmbca9qoq2g74anliq8m0dpgeq3i68ic.apps.googleusercontent.com`; it is a public identifier recovered from the site's normal Google authorization redirect.

For a local Android build, add this to `~/.gradle/gradle.properties` or pass it with `-P`:

```properties
SLATE_GOOGLE_SERVER_CLIENT_ID=712869496808-kmbca9qoq2g74anliq8m0dpgeq3i68ic.apps.googleusercontent.com
```

## Apple setup (later)

The Apple sign-in button and entitlement are intentionally disabled for the current preview. Developing and running the app in Simulator is free; App Store distribution and the Sign in with Apple capability require the Apple Developer Program. Once enrolled, create or update App ID `space.s1ate.app`, enable Sign in with Apple, restore the entitlement, and set `APPLE_BUNDLE_ID=space.s1ate.app` on the backend. Apple only returns a person's name on the first authorization, so Slate's prepared endpoint accepts it during that first exchange.

## Build iOS

The checked-in Xcode project is generated from `ios/project.yml` with XcodeGen:

```bash
cd ios
xcodegen generate
open Slate.xcodeproj
```

Choose your Apple Development team in Xcode, supply the Google IDs above, and run the `Slate` scheme. The app targets iOS 17 and later.

Command-line compile verification:

```bash
/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild \
  -project ios/Slate.xcodeproj \
  -scheme Slate \
  -destination "generic/platform=iOS Simulator" \
  build
```

Keep normal simulator ad-hoc signing enabled. Disabling code signing produces a linker-signed app without a usable application identity, which causes Google Sign-In and Slate's session store to fail when they write to Keychain.

## Build Android

Install Android SDK 37 and JDK 17 or newer, then run:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Account compatibility

Native identity mapping deliberately preserves the existing web owner ID for Google accounts, so signing in with the same Google account opens the same titles, lists, profile, ordering, ratings, and notes. Apple identities receive a normal Slate owner ID and can be linked later without changing the library schema.
