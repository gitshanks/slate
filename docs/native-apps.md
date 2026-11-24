# Slate native apps

Slate now has first-party native clients for both platforms:

- `ios/`: SwiftUI, Google Sign-In, Keychain-backed sessions, a GRDB offline library cache, and a share extension. Sign in with Apple is prepared server-side but hidden until an Apple Developer Program membership is active.
- `android/`: Jetpack Compose, Google Credential Manager, Android Keystore-backed sessions, a Room offline cache, and Android share-intent intake.
- `app/api/v1/`: a versioned account API shared by both clients.
- `contracts/openapi.yaml`: the checked-in wire contract for the native clients.

Both apps sign in to the existing Slate account, restore the session across launches, load cached data immediately, and refresh from Neon. They follow the web app's phone layout: a dark, poster-first library, mint as the only accent, and a floating dock.

Android was rebuilt in November 2026 to match the web app. iOS was ported to that rebuild, then brought level with the web in late November (Previews, search under the top bar, themes, Space, first-run picks, importing history, sharing lists); `docs/ios-web-parity.md` lists each screen and what is still different.

The Android feature set includes:

- One Library with a shelf selector (All, Up Next, Watching, Watched) and one Filters button that opens a sheet: Format, Genre, Year, Reaction, Sort
- A dock with Library, Discover and Lists, plus a button that finds and adds a title; every selector is the liquid selector from the web
- Library prompts: new episodes of shows you are watching, a nudge for small libraries, and a suggested first list
- Discover rails (recommended, trending, now playing, one per streaming service)
- Lists made by Slate, opened from `s1ate.space/l/<slug>` links
- Long-press drag and drop ordering with immediate local settlement and an asynchronous server save
- Full title pages with cast, crew, providers, trailers, recommendations, ratings, notes, list membership, and status controls
- Search across films, series, cast, and crew, with catalogue previews before a title is added
- Custom list creation, editing, deletion, membership, and ordering
- Inline profile editing, avatar upload, privacy controls, and public-profile sharing
- Link intake from the iOS share sheet, Android share sheet, or a pasted web link
- Keychain or Keystore-backed device sessions plus offline library caches

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

Check the layout without a phone or emulator:

```bash
./gradlew :app:testDebugUnitTest
```

This renders the Library, the Filters sheet and Discover at 320, 360, 412 and 800 dp wide into `android/app/build/shots/`.

## Release Android to testers

Google Play's internal testing track is Android's TestFlight: up to 100 testers by email, installs and updates through the Play Store, no review wait.

1. Make an upload key once, and keep the file and its passwords somewhere safe outside the repository:

   ```bash
   keytool -genkeypair -v -keystore slate-upload.jks -alias slate -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Create `android/keystore.properties` (ignored by git):

   ```properties
   storeFile=../slate-upload.jks
   storePassword=<the keystore password>
   keyAlias=slate
   keyPassword=<the key password>
   ```

   `storeFile` is read relative to `android/`, so `../slate-upload.jks` is a file beside the `android` folder; use any path you like.

3. Build the signed bundle. Every upload needs a higher version code:

   ```bash
   ./gradlew :app:bundleRelease -PSLATE_VERSION_CODE=2
   ```

   The bundle is written to `android/app/build/outputs/bundle/release/app-release.aab`.

4. In Play Console, create the app (package `space.s1ate.app`), open Testing > Internal testing, create a release, upload the bundle, add testers' Google addresses and send them the opt-in link.

5. Google sign-in only works for builds whose signing certificate Google knows. In Play Console open Test and release > Setup > App signing, copy the SHA-1 of the **app signing key**, and add it to the Android OAuth client in Google Cloud (see "Google Cloud setup"). Without this, testers see the sign-in sheet fail.

6. For `s1ate.space/l/<slug>` links to open the app, serve `/.well-known/assetlinks.json` from the site with the same key's SHA-256. Until then the links open in the browser, and `slate://l/<slug>` opens the app.

Firebase App Distribution is the alternative when testers are needed before a Play developer account is verified: build `./gradlew :app:assembleRelease`, upload the APK in the Firebase console, and invite testers by email. It skips the store, so testers must allow installs from the Firebase tester app, and the upload key's SHA-1 (not Play's) goes on the OAuth client.

## Account compatibility

Native identity mapping deliberately preserves the existing web owner ID for Google accounts, so signing in with the same Google account opens the same titles, lists, profile, ordering, ratings, and notes. Apple identities receive a normal Slate owner ID and can be linked later without changing the library schema.
