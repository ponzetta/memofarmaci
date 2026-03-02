package it.memofarmaci.app

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
        // ID deve corrispondere al channelId nel payload FCM del cron (api/push/cron.ts)
        val channelId = "memofarmaci-alarms"
        val notificationManager =
            getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Il canale viene creato in MainActivity.onCreate, ma lo riaggiungiamo
            // qui per sicurezza nel caso il servizio venga avviato prima dell'Activity
            val channel = NotificationChannel(
                channelId,
                "Promemoria farmaci",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                enableLights(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            // FLAG_ACTIVITY_NEW_TASK: necessario dal contesto Service.
            // Senza FLAG_ACTIVITY_CLEAR_TASK: con launchMode=singleTask, se l'app è in
            // background viene chiamato onNewIntent (niente reload); se è chiusa → onCreate.
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("planId", planId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
