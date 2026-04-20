package com.repliqe.app;

import android.os.Bundle;
import android.util.Log;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Custom Activity that locks the app into a dark, edge-to-edge appearance from the very first
 * frame so the system status bar and navigation bar never flash white during the boot sequence.
 *
 * Background:
 *   With targetSdkVersion=36 (Android 16) the system FORCES edge-to-edge: the system bars are
 *   transparent and the legacy attributes android:statusBarColor / android:navigationBarColor
 *   plus their setStatusBarColor() / setNavigationBarColor() Window setters are silently
 *   ignored. windowOptOutEdgeToEdgeEnforcement is ignored too on Android 16 devices.
 *   See https://developer.android.com/about/versions/16/behavior-changes-16
 *
 *   That means whatever is drawn behind the transparent bars is what shows.
 *
 * Approach:
 *   1. Theme parent is now Theme.AppCompat.NoActionBar (always dark) instead of
 *      Theme.AppCompat.DayNight.NoActionBar. That guarantees a dark windowBackground without
 *      having to call AppCompatDelegate.setDefaultNightMode at runtime — which on Android 16
 *      can trigger an activity recreate / configuration-change cycle that leaves the WebView
 *      in a state where document-level vertical scroll is wedged on every page that doesn't
 *      have its own internal overflow-y-auto container. (The active workout sheet was the
 *      only page that kept scrolling because it has its own scroller.) See styles.xml.
 *   2. WindowInsetsControllerCompat.setAppearanceLight*Bars(false) -> forces the bar glyphs
 *      (clock, battery, home indicator) to be rendered as LIGHT (white-ish) so they're visible
 *      against the dark background showing through the transparent bars. This is appearance
 *      only; it doesn't touch layout flags or system UI visibility flags, so it is scroll-safe.
 */
public class MainActivity extends BridgeActivity {

    private static final String TAG = "REPLIQE_INIT";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        Log.d(TAG, "MainActivity.onCreate: dark theme via styles.xml parent, "
                + "system bars set to light glyphs over transparent (edge-to-edge)");
    }
}
