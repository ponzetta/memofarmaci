package it.memofarmaci.app

import android.webkit.JavascriptInterface

/**
 * Bridge JavaScript → Kotlin esposto come window.AndroidBridge nella WebView.
 * I metodi annotati con @JavascriptInterface sono chiamabili dalla React app.
 */
class WebAppInterface(private val activity: MainActivity) {

    @JavascriptInterface
    fun signInWithGoogle() {
        activity.runOnUiThread {
            activity.startGoogleSignIn()
        }
    }
}
