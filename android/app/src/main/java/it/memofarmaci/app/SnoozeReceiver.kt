package it.memofarmaci.app

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat

class SnoozeReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val planId = intent.getStringExtra("planId") ?: return

        // Suona subito con audio nativo (schermo spento incluso)
        playAlarmSound(context, planId)

        // Salva planId in SharedPreferences per delivery via onResume()
        context.getSharedPreferences("mf_prefs", Context.MODE_PRIVATE)
            .edit().putString("pending_plan_id", planId).apply()

        // Intent che apre MainActivity con il planId
        val activityIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("planId", planId)
        }
        val contentPendingIntent = PendingIntent.getActivity(
            context,
            planId.hashCode(),
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        // fullScreenIntent: porta l'app in foreground automaticamente come una sveglia
        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            planId.hashCode() + 100,
            activityIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, "memofarmaci-alarms")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Promemoria farmaci")
            .setContentText("È ora di prendere il farmaco")
            .setContentIntent(contentPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(planId.hashCode(), notification)
    }

    private fun playAlarmSound(context: Context, planId: String) {
        try {
            MemoFarmaciFirebaseService.stopAlarmSound() // ferma eventuale precedente
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val ringtone = RingtoneManager.getRingtone(context, alarmUri) ?: return
            ringtone.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            ringtone.play()
            MemoFarmaciFirebaseService.activeRingtone = ringtone
        } catch (_: Exception) {}
    }
}
