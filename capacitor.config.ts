import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.repliqe.app',
  appName: 'REPLIQE',
  webDir: 'dist',
  // Match --bg-app from src/index.css so overscroll bounce reveals the dark backstop, not the default white WKWebView surface.
  backgroundColor: '#0D0D1A',
  server: {
    iosScheme: 'capacitor',
    androidScheme: 'https',
  },
  ios: {
    backgroundColor: '#0D0D1A',
    // 'never' = WKWebView's scrollView.contentInsetAdjustmentBehavior = .never. Combined with viewport-fit=cover and the
    // CSS env(safe-area-inset-*) padding, the app controls its own safe-area handling.
    contentInset: 'never',
    scrollEnabled: true,
    // Light status bar text on the dark theme.
    overrideUserInterfaceStyle: 'dark',
  },
  android: {
    backgroundColor: '#0D0D1A',
  },
  plugins: {
    StatusBar: {
      // We disable overlay so the system status bar gets its own area; CSS env(safe-area-inset-top) is then 0 on iOS
      // and the WKWebView frame already starts below the Dynamic Island / notch.
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#0D0D1A',
    },
    SplashScreen: {
      // Boot sequence (both platforms):
      //   1. OS system splash — Android 12+ Theme.SplashScreen icon-only, iOS LaunchScreen storyboard
      //   2. brand splash (inline SVG in index.html) — full REPLIQE composition, faded from src/main.jsx
      //   3. React app
      //
      // launchShowDuration: 0 disables the @capacitor/splash-screen plugin's launch overlay entirely.
      // The plugin is only meant to bridge the OS splash -> WebView gap, but on Android 12+ it can ONLY
      // render the launcher icon (no wordmark/tagline), and any extra plugin overlay before the brand
      // splash creates a visible double/triple splash effect. Letting the OS splash hand off straight
      // to the WebView (with our inline HTML splash already painting) eliminates that.
      launchAutoHide: true,
      launchShowDuration: 0,
      backgroundColor: '#0D0D1A',
      androidSplashResourceName: 'splash',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false,
      // splashFullScreen / splashImmersive intentionally OMITTED.
      // Setting splashImmersive: true puts the WebView into IMMERSIVE_STICKY mode (hides
      // system bars and intercepts edge swipes). Even with launchShowDuration: 0 the plugin
      // still applies the immersive UI flags during onCreate, and on Android 14+/16 those
      // flags can leak and break document-level vertical scroll (the body stops scrolling
      // on every screen that doesn't have its own overflow-y-auto container — Workout's
      // active sheet still scrolled because it has its own internal scroller). We render
      // our own brand splash from index.html so the plugin doesn't need to hide bars at all.
    },
  },
};

export default config;
