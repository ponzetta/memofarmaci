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

    /** React chiama questo quando è pronto per ricevere il token FCM */
    @JavascriptInterface
    fun getFcmToken(): String = activity.getCurrentFcmToken()

    /** React chiama questo al mount per recuperare un planId di allarme pendente */
    @JavascriptInterface
    fun getAlarmPlanId(): String = activity.getAlarmPlanId()

    /** Schedula un allarme nativo (snooze) via AlarmManager.
     *  delayMs è Double perché JavaScript non ha Long e il WebView bridge
     *  mappa i numeri JS a double Java: se usiamo Long il metodo non viene trovato. */
    @JavascriptInterface
    fun scheduleSnoozeAlarm(planId: String, delayMs: Double) {
        activity.scheduleSnoozeAlarm(planId, delayMs.toLong())
    }
}
