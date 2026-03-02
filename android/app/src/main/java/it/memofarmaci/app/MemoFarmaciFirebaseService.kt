package it.memofarmaci.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MemoFarmaciFirebaseService : FirebaseMessagingService() {

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
        showNotification(title, body, planId)

        // Se MainActivity è viva in background, consegna il planId direttamente
        // alla WebView senza richiedere il tap sulla notifica.
        if (planId.isNotEmpty()) {
            MainActivity.instance?.get()?.deliverAlarmPlanId(planId)
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
        // fullScreenIntent: porta l'app in foreground automaticamente (come sveglia)
        // Su Samsung/MIUI bypassa le restrizioni sulla WebView in background.
        // Con launchMode=singleTask → onNewIntent() se l'app è in background,
        // onCreate() se è chiusa.
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
