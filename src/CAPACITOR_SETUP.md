# Capacitor Setup for REPLIQE

Wrap the existing Vite + React PWA in Capacitor to produce native iOS and Android apps.

The commands below assume the repo root; all paths are relative to it. `@capacitor/core`, `@capacitor/camera`, and `@capacitor/filesystem` are already in `package.json` (v8). The matching CLI and native platforms must be the same major version.

---

## 1. Install missing Capacitor packages

```bash
npm install @capacitor/cli@^8 @capacitor/ios@^8 @capacitor/android@^8
```

## 2. Initialize Capacitor

```bash
npx cap init REPLIQE com.repliqe.app --web-dir dist
```

This creates `capacitor.config.json` (or `.ts`). After init, edit it so it includes the fields below — some are required for Firebase Auth (Google/Apple sign-in), CORS, and iOS gestures:

```json
{
  "appId": "com.repliqe.app",
  "appName": "REPLIQE",
  "webDir": "dist",
  "server": {
    "iosScheme": "capacitor",
    "androidScheme": "https"
  },
  "ios": {
    "contentInset": "always"
  }
}
```

> `androidScheme: "https"` means the Android webview origin is `https://localhost`, so Firebase Auth + Storage see a secure origin (add this to Authorized domains / CORS, see below).

## 3. Configure Vite for Capacitor (`vite.config.js`)

Set `base: './'` so built asset URLs stay relative. Keep React + Tailwind plugins as they are:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 900 },
})
```

> `index.html` uses absolute URLs like `/manifest.json`, `/icon.svg` — they resolve against the Capacitor webview origin, so they still load. Only the Vite-emitted bundle paths need to be relative.

## 4. Disable the web Service Worker in native builds

The PWA service worker (`public/sw.js`) interferes with Capacitor’s webview cache — on iOS it isn’t even supported over `capacitor://`. Guard registration in `src/main.jsx`:

```js
import { Capacitor } from '@capacitor/core'

if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
```

Also, remove the unconditional `localStorage.clear()` in `main.jsx` before native testing — it wipes Firebase Auth’s cached session on every cold start inside the app. Either delete it, or guard with `if (!Capacitor.isNativePlatform())`.

## 5. Firebase Auth: Authorized domains

In [Firebase Console → Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/repliqe-710d2/authentication/settings), add:

- `localhost` (Android — `androidScheme: "https"` → origin `https://localhost`)
- `capacitor` — not needed; iOS uses `capacitor://localhost` but Firebase treats it as native-safe via the SDK’s `signInWithCredential` flow.
- `app.repliqe.com` (production web/PWA target)

For **Google Sign-In** / **Apple Sign-In** you’ll additionally want the native providers (`@codetrix-studio/capacitor-google-auth`, `@capacitor-community/apple-sign-in`) because `signInWithPopup` / `signInWithRedirect` don’t work reliably inside the WKWebView.

## 6. Storage CORS

`storage-cors.json` already lists:

```
capacitor://localhost
ionic://localhost
https://localhost
http://localhost
```

Push with:

```bash
npm run storage:cors
```

## 7. Portrait orientation (native-side lock)

The web `screen.orientation.lock('portrait')` call in `src/orientationPortrait.js` doesn’t work inside Capacitor’s webview. Lock at the native level instead:

**iOS — `ios/App/App/Info.plist`:**

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
</array>
```

**Android — `android/app/src/main/AndroidManifest.xml`** on the main `<activity>`:

```xml
android:screenOrientation="portrait"
```

## 8. Keep-awake (replace Wake Lock API)

Wake Lock API isn’t available in iOS WKWebView. Install:

```bash
npm install @capacitor-community/keep-awake
```

Then in `App.jsx`, branch on platform — use `KeepAwake.keepAwake()` / `KeepAwake.allowSleep()` on native, existing `navigator.wakeLock.request('screen')` on web. Only activate when the user setting `keepScreenAwake` is on and a workout is active.

## 9. Icons, splash, bundle ID

- App ID: `com.repliqe.app` (set in `capacitor.config.json`). Verify in Xcode and Android Studio under bundle identifier / applicationId.
- Generate native icons and splash once you have high-res art:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate
```

- Place source images at `assets/icon-only.png` (1024×1024), `assets/splash.png` (2732×2732), etc.

## 10. Deep links (optional but recommended)

To make `https://app.repliqe.com/...` open the app directly:

- **iOS**: enable Associated Domains capability, add `applinks:app.repliqe.com`, host `.well-known/apple-app-site-association` on the web.
- **Android**: add `<intent-filter android:autoVerify="true">` with `android:host="app.repliqe.com"`, host `.well-known/assetlinks.json`.

## 11. Build, add platforms, sync

```bash
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

## 12. Open in IDE

```bash
npx cap open ios      # requires Xcode
npx cap open android  # requires Android Studio
```

---

## 13. Native Google + Apple Sign-In (Firebase Auth)

The app uses `@capgo/capacitor-social-login` (the maintained Capacitor 8-compatible plugin; the older `@codetrix-studio/capacitor-google-auth` only supports Capacitor ≤ 6). On web, the existing Firebase Auth popup flow (`signInWithPopup`) is used. On native, the plugin returns an `idToken` that is exchanged via `signInWithCredential(auth, ...)`. Logic lives in `src/lib/auth.ts` and is initialized at boot in `src/main.jsx` via `ensureSocialLoginInitialized()`.

### 13.1 Create OAuth client IDs

Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=repliqe-710d2) for the Firebase project (`repliqe-710d2`).

You need three OAuth 2.0 client IDs:

1. **Web client** (already created by Firebase as “Web client (auto created by Google Service)” — used by Firebase Auth itself).
2. **iOS client** — type `iOS`, bundle ID `com.repliqe.app`. Note its **Client ID** and **iOS URL scheme** (the reversed client ID).
3. **Android client** — type `Android`, package `com.repliqe.app`, with **SHA-1 fingerprint** of your debug and release signing keys. Get the debug SHA-1 with:
   ```bash
   keytool -keystore ~/.android/debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android
   ```
   For Play Store release builds, also add Google Play’s **app-signing certificate SHA-1** (Play Console → Setup → App signing).

In **Firebase Console → Authentication → Sign-in method**: enable **Google** and **Apple** providers. For Apple, paste the **Services ID** (Apple Developer → Identifiers → Services IDs) and the **Team ID + Key ID + private key** (`.p8`) from Apple.

### 13.2 Apple Developer setup (iOS only requires App ID; Android also requires Service ID)

- **Apple Developer → Identifiers → App IDs → `com.repliqe.app`**: enable the **Sign in with Apple** capability.
- (Android only) Create a **Services ID** (e.g. `com.repliqe.app.signin`) with **Sign in with Apple** enabled, configured with a redirect URL pointing to a page you control (or use Broadcast Channel mode in the plugin config to skip this).
- Apple Developer → Keys → create a key with **Sign in with Apple** enabled; download the `.p8`.

### 13.3 Project files to fill in

After steps 13.1–13.2, replace the placeholders:

- **`.env.local`** (copy from `.env.example`):
  ```
  VITE_GOOGLE_WEB_CLIENT_ID=120692948250-XXXXXXXXX.apps.googleusercontent.com
  VITE_GOOGLE_IOS_CLIENT_ID=120692948250-YYYYYYYYY.apps.googleusercontent.com
  VITE_APPLE_SERVICE_ID=com.repliqe.app.signin   # Android only
  VITE_APPLE_REDIRECT_URL=                        # Android only (or empty if using Broadcast Channel)
  ```
- **`ios/App/App/Info.plist`** → `GIDClientID` and `CFBundleURLSchemes` entry use the **iOS** client ID (and its reversed form `com.googleusercontent.apps.<iOS_CLIENT_ID>`).
- **`android/app/src/main/res/values/strings.xml`** → `server_client_id` is the **Web** client ID.

### 13.4 Sign in with Apple capability

Already wired in this repo:
- `ios/App/App/App.entitlements` enables `com.apple.developer.applesignin`.
- `ios/App/App.xcodeproj/project.pbxproj` references the entitlement file via `CODE_SIGN_ENTITLEMENTS`.

You still need to: open Xcode → App target → Signing & Capabilities → confirm **Sign in with Apple** is listed. Xcode will provision the App ID with the capability automatically when you build with a development team.

### 13.5 Authorized domains in Firebase Auth

Under **Firebase Console → Authentication → Settings → Authorized domains**, add:

- `localhost` (Android — origin is `https://localhost` thanks to `androidScheme: 'https'`)
- `app.repliqe.com` (PWA / production web)

(`capacitor://localhost` is *not* added here — Firebase trusts native credential exchange via `signInWithCredential` regardless of origin.)

### 13.6 Rebuild

After changing `.env.local` or any of the native config files:

```bash
npm run build && npx cap sync
```

---

## Recap of things that differ from a plain web PWA

| Concern            | Web (PWA)                                        | Capacitor (native) |
| ------------------ | ------------------------------------------------ | ------------------ |
| Service worker     | Registered in `main.jsx`                         | Skipped (guarded by `Capacitor.isNativePlatform()`) |
| `localStorage.clear()` at boot | Fine (new sessions only)               | Remove / guard — would wipe Firebase Auth every launch |
| Orientation lock   | `screen.orientation.lock` + CSS fallback         | `Info.plist` / `AndroidManifest.xml` |
| Keep screen awake  | `navigator.wakeLock`                             | `@capacitor-community/keep-awake` |
| Google/Apple sign-in | `signInWithPopup` / `signInWithRedirect`       | Native plugin + `signInWithCredential` |
| Asset paths        | Absolute (`/…`) — fine                           | Also fine, but bundles need `base: './'` |
| CORS               | `app.repliqe.com`                                | Add `capacitor://localhost`, `https://localhost` |
