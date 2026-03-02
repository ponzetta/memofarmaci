package it.memofarmaci.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MemoFarmaciFirebaseService : FirebaseMessagingService() {

    companion object {
        // Suoneria attiva: fermata da stopAlarmSound() quando l'utente conferma
        @Volatile var activeRingtone: Ringtone? = null

        fun stopAlarmSound() {
            activeRingtone?.stop()
            activeRingtone = null
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Il token aggiornato verrà passato alla WebView al prossimo avvio dell'app
        // tramite MainActivity.registerFcmToken()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "MemoFarmaci"
        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: ""

        val planId = remoteMessage.data["planId"] ?: ""

        // WakeLock: mantiene la CPU sveglia anche con schermo spento.
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "MemoFarmaci::FCMWakeLock"
        )
        wakeLock.acquire(30_000L)
        try {
            if (planId.isNotEmpty()) {
                // 1. Suona subito con audio nativo (funziona anche con schermo spento,
                //    indipendentemente dalla WebView)
                playAlarmSound()
                // 2. Salva planId in SharedPreferences come backup per onResume()
                getSharedPreferences("mf_prefs", MODE_PRIVATE)
                    .edit().putString("pending_plan_id", planId).apply()
            }
            // 3. Mostra la notifica con fullScreenIntent (porta l'app in foreground)
            showNotification(title, body, planId)
            // 4. Delivery diretta alla WebView se l'app è già attiva in foreground
            if (planId.isNotEmpty()) {
                MainActivity.instance?.get()?.deliverAlarmPlanId(planId)
            }
        } finally {
            wakeLock.release()
        }
    }

    private fun playAlarmSound() {
        try {
            stopAlarmSound() // ferma eventuale suoneria precedente
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(applicationContext, alarmUri) ?: return
            ringtone.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            ringtone.play()
            activeRingtone = ringtone
            // Auto-stop dopo 60 secondi se l'utente non ha ancora interagito
            Handler(Looper.getMainLooper()).postDelayed({ stopAlarmSound() }, 60_000L)
        } catch (_: Exception) {
            // Su alcuni device il ringtone alarm non è disponibile: nessun crash
        }
    }

    private fun showNotification(title: String, body: String, planId: String) {
        val channelId = "memofarmaci-alarms"
        val notificationManager =
            getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Promemoria farmaci",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                enableLights(true)
                // Mostra la notifica anche sulla lock screen
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("planId", planId)
        }
        // contentIntent: tap sulla notifica nel cassetto
        val contentPendingIntent = PendingIntent.getActivity(
            this, planId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // fullScreenIntent: porta l'app in foreground automaticamente (come sveglia).
        // Con launchMode=singleTask → onNewIntent() se app in background, onCreate() se chiusa.
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, planId.hashCode() + 1, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(planId.hashCode(), notification)
    }
}
