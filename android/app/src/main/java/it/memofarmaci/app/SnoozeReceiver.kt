package it.memofarmaci.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

class SnoozeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val planId = intent.getStringExtra("planId") ?: return

        // Apre MainActivity con il planId, come fa FCM
        val activityIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("planId", planId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            planId.hashCode(),
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, "memofarmaci-alarms")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Promemoria farmaci")
            .setContentText("È ora di prendere il farmaco")
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(planId.hashCode(), notification)
    }
}
