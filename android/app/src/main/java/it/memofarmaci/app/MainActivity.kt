package it.memofarmaci.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialException
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var currentFcmToken: String? = null
    // planId da consegnare alla WebView (tap su notifica FCM)
    private var pendingAlarmPlanId: String? = null

    // Launcher per richiedere POST_NOTIFICATIONS (Android 13+)
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* noop */ }

    companion object {
        // Web Client ID del progetto Supabase (815488260722), NON del progetto Firebase
        const val WEB_CLIENT_ID =
            "815488260722-nu7nsn9m8tlrpk9pqb97j3ra7cslkhsv.apps.googleusercontent.com"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        supportActionBar?.hide()

        // Display edge-to-edge (status bar e navigation bar trasparenti)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        webView = WebView(this)
        setContentView(webView)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            mediaPlaybackRequiresUserGesture = false
        }

        // Bridge JavaScript → Kotlin: window.AndroidBridge.signInWithGoogle()
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                // Tutto il traffico resta nella WebView
                return false
            }

            override fun onPageFinished(view: WebView, url: String) {
                // Passa il token FCM alla WebView dopo il caricamento completo della pagina,
                // così window.onFcmToken è già registrato dal codice React
                registerFcmToken()
                // Consegna l'allarme pendente (app era chiusa, ora React è montato)
                // Usiamo un delay per dare a React il tempo di registrare window.onAlarmFromNotification
                val planIdToDeliver = pendingAlarmPlanId
                if (planIdToDeliver != null) {
                    pendingAlarmPlanId = null
                    view.postDelayed(Runnable { deliverAlarmPlanId(planIdToDeliver) }, 1500L)
                }
            }
        }

        webView.webChromeClient = WebChromeClient()

        // Carica l'app React da Vercel
        webView.loadUrl("https://memofarmaci-wm25.vercel.app")

        // Leggi planId dall'intent se l'app era chiusa (FCM notification tap)
        intent.getStringExtra("planId")?.takeIf { it.isNotEmpty() }?.let {
            pendingAlarmPlanId = it
        }

        // Android 13+: richiedi permesso notifiche push
        requestNotificationPermission()

        // Crea il canale notifiche usato sia dall'app sia dal cron FCM
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            // ID deve corrispondere al channelId nel payload FCM del cron (api/push/cron.ts)
            val channel = NotificationChannel(
                "memofarmaci-alarms",
                "Promemoria farmaci",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifiche per la presa dei farmaci"
                enableVibration(true)
                enableLights(true)
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    /**
     * Avvia il Google Sign-In nativo via Credential Manager.
     * Chiamato da WebAppInterface.signInWithGoogle() tramite il bridge JS.
     */
    fun startGoogleSignIn() {
        val credentialManager = CredentialManager.create(this)

        val googleIdOption = GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(WEB_CLIENT_ID)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val result = credentialManager.getCredential(
                    request = request,
                    context = this@MainActivity,
                )
                val googleIdTokenCredential =
                    GoogleIdTokenCredential.createFrom(result.credential.data)
                val idToken = googleIdTokenCredential.idToken

                // Passa il token alla WebApp per completare il login con Supabase
                webView.evaluateJavascript(
                    "window.onGoogleSignInResult && window.onGoogleSignInResult('${
                        idToken.replace("'", "\\'")
                    }')",
                    null
                )
            } catch (e: GetCredentialException) {
                val errorMsg = (e.message ?: "Google Sign-In fallito").replace("'", "\\'")
                webView.evaluateJavascript(
                    "window.onGoogleSignInError && window.onGoogleSignInError('$errorMsg')",
                    null
                )
            }
        }
    }

    /** Token FCM corrente, leggibile da React via AndroidBridge.getFcmToken() */
    fun getCurrentFcmToken(): String = currentFcmToken ?: ""

    private fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                currentFcmToken = task.result
                val escaped = currentFcmToken!!.replace("'", "\\'")
                webView.post {
                    // Callback push (se React è già pronto); altrimenti React userà getFcmToken()
                    webView.evaluateJavascript(
                        "window.onFcmToken && window.onFcmToken('$escaped')",
                        null
                    )
                }
            }
        }
    }

    /** App in background: tap su notifica FCM → onNewIntent */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val planId = intent.getStringExtra("planId") ?: return
        if (planId.isEmpty()) return
        // WebView già caricata → consegna subito
        deliverAlarmPlanId(planId)
    }

    private fun deliverAlarmPlanId(planId: String) {
        val escaped = planId.replace("'", "\\'")
        webView.post {
            webView.evaluateJavascript(
                "window.onAlarmFromNotification && window.onAlarmFromNotification('$escaped')",
                null
            )
        }
    }

    /** React chiama questo al mount per controllare se c'è un allarme pendente */
    fun getAlarmPlanId(): String {
        val id = pendingAlarmPlanId ?: ""
        pendingAlarmPlanId = null
        return id
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }
}
