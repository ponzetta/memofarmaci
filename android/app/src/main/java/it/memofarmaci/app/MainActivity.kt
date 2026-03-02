package it.memofarmaci.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.WindowCompat
import java.io.File
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

    // File chooser per <input type="file"> nella WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null
    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback
            filePathCallback = null
            when {
                result.resultCode == Activity.RESULT_OK && result.data?.data != null ->
                    callback?.onReceiveValue(arrayOf(result.data!!.data!!))
                result.resultCode == Activity.RESULT_OK && cameraImageUri != null ->
                    callback?.onReceiveValue(arrayOf(cameraImageUri!!))
                else -> callback?.onReceiveValue(null)
            }
            cameraImageUri = null
        }

    // Launcher per richiedere POST_NOTIFICATIONS (Android 13+)
    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* noop */ }

    companion object {
        // Web Client ID del progetto Supabase (815488260722), NON del progetto Firebase
        const val WEB_CLIENT_ID =
            "815488260722-nu7nsn9m8tlrpk9pqb97j3ra7cslkhsv.apps.googleusercontent.com"

        // Riferimento debole all'istanza attiva: usato da MemoFarmaciFirebaseService per
        // consegnare il planId direttamente alla WebView quando l'app è in background.
        var instance: java.lang.ref.WeakReference<MainActivity>? = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        instance = java.lang.ref.WeakReference(this)

        // Se l'app è stata aperta da una notifica allarme (schermo spento),
        // accendi lo schermo e mostra sopra la lock screen.
        intent.getStringExtra("planId")?.takeIf { it.isNotEmpty() }?.let {
            turnScreenOn()
        }

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

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                // Annulla eventuale callback precedente rimasta in sospeso
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                // File temporaneo per la fotocamera
                val photoFile = File.createTempFile("photo_", ".jpg", cacheDir)
                cameraImageUri = FileProvider.getUriForFile(
                    this@MainActivity,
                    "${packageName}.fileprovider",
                    photoFile
                )
                val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                    putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                }
                val galleryIntent = Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*" }
                val chooser = Intent.createChooser(galleryIntent, "Seleziona foto")
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
                fileChooserLauncher.launch(chooser)
                return true
            }
        }

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

        // Chiedi di escludere l'app dalla battery optimization:
        // impedisce ad Android di uccidere FCM e i servizi in background
        requestIgnoreBatteryOptimization()

        // Android 12 (API 31-32): SCHEDULE_EXACT_ALARM richiede approvazione utente.
        // Su Android 13+ USE_EXACT_ALARM viene concessa automaticamente all'installazione.
        requestExactAlarmPermission()
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
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun turnScreenOn() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
    }

    private fun requestExactAlarmPermission() {
        // Su Android 13+ USE_EXACT_ALARM è concessa automaticamente: nessuna azione necessaria.
        // Su Android 12 (API 31-32) SCHEDULE_EXACT_ALARM richiede che l'utente la abiliti
        // in Impostazioni → App → MemoFarmaci → Sveglie e promemoria.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                    // Fallback: apri le impostazioni generali dell'app
                    try {
                        startActivity(
                            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                data = Uri.parse("package:$packageName")
                            }
                        )
                    } catch (_: Exception) {}
                }
            }
        }
    }

    private fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                    // Alcuni ROM non supportano questa intent diretta
                }
            }
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

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.resumeTimers()
        // Consegna planId salvato dal service FCM o da SnoozeReceiver.
        // Fallback affidabile per screen-off: anche se fullScreenIntent non porta
        // l'app in foreground, quando l'utente apre manualmente l'app questo viene eseguito.
        val prefs = getSharedPreferences("mf_prefs", MODE_PRIVATE)
        val planId = prefs.getString("pending_plan_id", null)
        if (!planId.isNullOrEmpty()) {
            prefs.edit().remove("pending_plan_id").apply()
            // Breve delay per garantire che il JS della WebView sia pronto
            webView.postDelayed({ deliverAlarmPlanId(planId) }, 300L)
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        webView.pauseTimers()
    }

    /** App in background: tap su notifica FCM → onNewIntent */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val planId = intent.getStringExtra("planId") ?: return
        if (planId.isEmpty()) return
        // Accendi lo schermo anche se arrivato in background
        turnScreenOn()
        // Risveglia la WebView prima di consegnare (potrebbe essere in pausa)
        webView.onResume()
        webView.resumeTimers()
        // WebView già caricata → consegna subito
        deliverAlarmPlanId(planId)
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    // internal: accessibile da MemoFarmaciFirebaseService nello stesso package
    internal fun deliverAlarmPlanId(planId: String) {
        val escaped = planId.replace("'", "\\'")
        webView.post {
            webView.evaluateJavascript(
                "window.onAlarmFromNotification && window.onAlarmFromNotification('$escaped')",
                null
            )
        }
    }

    /**
     * Schedula l'allarme per un farmaco specifico al momento esatto (delayMs da adesso).
     * Chiamato da React quando todaysSchedule si carica. setAlarmClock è garantito anche
     * in Doze mode e Samsung Deep Sleep — è il meccanismo delle sveglie di sistema.
     * requestCode = planId.hashCode() + 500 per non collidere con gli allarmi snooze.
     */
    fun scheduleNextAlarm(planId: String, delayMs: Long) {
        val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, SnoozeReceiver::class.java).apply {
            putExtra("planId", planId)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            planId.hashCode() + 500,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = System.currentTimeMillis() + delayMs
        alarmManager.setAlarmClock(
            AlarmManager.AlarmClockInfo(triggerAt, pendingIntent),
            pendingIntent
        )
    }

    /**
     * Cancella l'allarme locale per un farmaco (chiamato quando l'utente conferma l'assunzione).
     */
    fun cancelMedicationAlarm(planId: String) {
        val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, SnoozeReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            planId.hashCode() + 500,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        ) ?: return
        alarmManager.cancel(pendingIntent)
        pendingIntent.cancel()
    }

    /**
     * Schedula un allarme snooze via AlarmManager che scatta dopo delayMs millisecondi.
     * Chiamato da WebAppInterface.scheduleSnoozeAlarm() tramite il bridge JS.
     */
    fun scheduleSnoozeAlarm(planId: String, delayMs: Long) {
        val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
        val intent = Intent(this, SnoozeReceiver::class.java).apply {
            putExtra("planId", planId)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            this,
            planId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = System.currentTimeMillis() + delayMs
        alarmManager.setAlarmClock(
            AlarmManager.AlarmClockInfo(triggerAt, pendingIntent),
            pendingIntent
        )
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
