package it.memofarmaci.app

import android.Manifest
import android.annotation.SuppressLint
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
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
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
        installSplashScreen()
        // Passa da Theme.SplashScreen a un tema AppCompat prima di super.onCreate()
        setTheme(R.style.AppTheme_NoActionBar)
        super.onCreate(savedInstanceState)

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
            }
        }

        webView.webChromeClient = WebChromeClient()

        // Carica l'app React da Vercel
        webView.loadUrl("https://memofarmaci-wm25.vercel.app")

        // Android 13+: richiedi permesso notifiche push
        requestNotificationPermission()
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
