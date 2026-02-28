# MemoFarmaci — Documento di Specifica Tecnica

**Versione:** 1.0 — Febbraio 2026
**Repository:** `ponzetta/memofarmaci`
**Branch principale:** `development`
**Deploy web:** `https://memofarmaci-wm25.vercel.app`
**App ID Android:** `it.memofarmaci.app`

---

## 1. Panoramica

MemoFarmaci è un'applicazione per la gestione della terapia farmacologica personale. Permette all'utente di registrare i propri farmaci, pianificare la terapia con orari e frequenze, registrare le assunzioni e ricevere notifiche di promemoria. È disponibile sia come **Progressive Web App (PWA)** che come **app Android nativa** (tramite Capacitor), con supporto multi-utente e un sistema di alert per caregiver.

---

## 2. Stack Tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 + TailwindCSS 4 |
| Backend / API | Vercel Serverless Functions (TypeScript) |
| Database | Supabase (PostgreSQL) |
| Autenticazione | Supabase Auth — OAuth Google + Facebook |
| Storage foto | Supabase Storage (bucket privato `medication-photos`) |
| Push web | Web Push API + VAPID |
| Push nativa | Firebase Cloud Messaging (FCM) via `firebase-admin` |
| App mobile | Capacitor 7 (`@capacitor/android`) |
| PWA | `vite-plugin-pwa` con Service Worker custom (`injectManifest`) |
| Notifiche email | Resend |
| Bot Telegram | Telegram Bot API (webhook) |
| Cron | cron-job.org (Vercel Hobby non supporta cron < 1/giorno) |
| Deploy | Vercel |

---

## 3. Architettura Generale

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT                           │
│  React SPA (PWA) ←→ Service Worker                 │
│  oppure App Android (Capacitor + WebView)           │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────┐
│              VERCEL (Serverless)                    │
│  /api/push/subscribe      → registra dispositivo   │
│  /api/push/cron           → invia notifiche        │
│  /api/push/vapid-public-key → chiave pubblica VAPID│
│  /api/telegram/webhook    → bot Telegram           │
│  /api/auth/telegram-link  → genera codice MF-XXXX  │
│  /api/auth/telegram-link-status → verifica link    │
│  /api/alerts/send-email   → email caregiver        │
│  /api/alerts/send-telegram → Telegram caregiver    │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  SUPABASE                           │
│  PostgreSQL + Auth + Storage + RLS                  │
└─────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Firebase FCM              Telegram API
  (push Android)           (messaggi bot)
```

---

## 4. Autenticazione e Profilo Utente

### Flusso di accesso

```
AppRouter.tsx
  ├── Non autenticato  → LoginPage (OAuth Google / Facebook)
  ├── Autenticato, profilo incompleto → CompleteProfilePage
  └── Autenticato, profilo completo  → App
```

- **`AuthContext.tsx`** espone `session`, `user`, `signOut` tramite React Context
- **`LoginPage`** gestisce il redirect OAuth con `supabase.auth.signInWithOAuth()`
- **`CompleteProfilePage`** raccoglie nome, cognome e dati opzionali (telefono, data di nascita, CAP) al primo accesso
- **RLS su tutte le tabelle:** ogni utente accede esclusivamente ai propri dati (`auth.uid() = user_id`)

---

## 5. Funzionalità Principali

### 5.1 Gestione Farmaci
- Aggiunta farmaco con nome, foto scatola e foto pillola
- Upload foto con crop interattivo (`react-easy-crop`) e salvataggio su Supabase Storage
- URL firmati con scadenza 1h per accesso sicuro alle immagini private
- Modifica e cancellazione farmaci

### 5.2 Piani Terapeutici
- Creazione piano con: farmaco, orario, dosaggio, frequenza (giornaliera / a giorni alterni), data inizio/fine
- Lista piani attivi con filtro per data corrente
- Modifica e cancellazione piani
- Calcolo automatico giorni alterni dall'`start_date`

### 5.3 Promemoria Giornalieri
- Schermata home con lista farmaci del giorno ordinata per orario
- Indicatore visivo: grigio (futuro) → verde (in orario) → rosso pulsante (in ritardo > 30 min)
- Conferma assunzione con registrazione su `intake_logs` (vincolo UNIQUE per evitare doppi log)
- Dettaglio farmaco con foto al tap

### 5.4 Allarme Audio
- All'orario della dose, o al ricevimento notifica push, si attiva una **AlarmModal** con suono e vibrazione
- Suono generato via **Web Audio API** (`AudioContext` + oscillatore a 880 Hz con pattern beep)
- Vibrazione tramite `navigator.vibrate([300, 150, 300, 150, 300])`
- `ctx.resume()` chiamato esplicitamente per sbloccare l'AudioContext su Android
- Il suono si ferma alla conferma dell'assunzione

### 5.5 Storico Assunzioni
- Log completo con data, orario e farmaco per ogni assunzione registrata

### 5.6 Effetti Collaterali
- Registrazione effetti collaterali associati a un farmaco con descrizione e timestamp

### 5.7 Appuntamenti
- Creazione appuntamenti con medico, luogo e data/ora
- Promemoria locale 1 ora prima tramite `setTimeout` + `Notification` API
- Visualizzazione nella home insieme ai farmaci del giorno

### 5.8 Impostazioni
- Configurazione alert mancata assunzione (ore di ritardo prima dell'alert)
- Abilitazione canali: email caregiver, Telegram utente, Telegram caregiver
- Link account Telegram tramite codice `MF-XXXXXX` generato dal bot (scadenza 10 min)
- Dati caregiver (nome, email, chat Telegram)

---

## 6. Schema Database (Supabase / PostgreSQL)

### `user_profiles`
Estende `auth.users`. Contiene dati personali, configurazione alert e riferimenti Telegram.

| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | FK → `auth.users` |
| `first_name`, `last_name` | TEXT | Obbligatori |
| `phone`, `email`, `birth_date`, `postal_code` | vari | Opzionali |
| `caregiver_name`, `caregiver_phone`, `caregiver_email` | TEXT | Per alert caregiver |
| `alert_email_enabled` | BOOLEAN | Abilita email caregiver |
| `alert_telegram_user_enabled` | BOOLEAN | Abilita Telegram utente |
| `alert_telegram_caregiver_enabled` | BOOLEAN | Abilita Telegram caregiver |
| `telegram_user_chat_id` | TEXT | Chat ID ottenuto via bot |
| `telegram_caregiver_chat_id` | TEXT | Chat ID caregiver |
| `telegram_link_token` | TEXT | Codice MF-XXXXXX temporaneo |
| `missed_dose_alert_hours` | INTEGER | Default: 2 ore |
| `profile_completed` | BOOLEAN | Gate per CompleteProfilePage |

### `medications`
| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `name` | TEXT | |
| `box_photo_path` | TEXT | Path in Supabase Storage |
| `pill_photo_path` | TEXT | Path in Supabase Storage |

### `medication_plans`
| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id`, `medication_id` | UUID FK | |
| `time` | TEXT | Formato `HH:MM` |
| `dosage` | TEXT | Es. "1 compressa" |
| `frequency` | TEXT | `daily` o `alternate` |
| `start_date`, `end_date` | DATE | |

### `intake_logs`
| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id`, `plan_id`, `medication_id` | UUID FK | |
| `schedule_time` | TEXT | |
| `schedule_date` | DATE | |
| `taken_at` | TIMESTAMPTZ | |
| UNIQUE | `(plan_id, schedule_date, schedule_time)` | Evita doppi log |

### `push_subscriptions`
| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `device_id` | TEXT | UUID generato lato client |
| `endpoint`, `p256dh`, `auth_key` | TEXT | Per Web Push VAPID |
| `fcm_token` | TEXT | Per push nativa FCM (migration 003) |
| `platform` | TEXT | `android`, `ios`, o null per browser |
| UNIQUE | `(user_id, device_id)` | Un record per dispositivo |

### `alert_sent_log`
| Campo | Tipo | Note |
|---|---|---|
| `id` | UUID PK | |
| `user_id`, `plan_id` | UUID | |
| `schedule_date`, `schedule_time` | DATE/TEXT | |
| `channel` | TEXT | `push`, `email`, `telegram_user`, `telegram_caregiver`, `telegram_user_reminder` |
| UNIQUE | `(plan_id, schedule_date, schedule_time, channel)` | Deduplication |

### `side_effects`, `appointments`
Tabelle standard con `user_id`, descrizione/dati e timestamp.

---

## 7. API Backend (Vercel Serverless)

### `POST /api/push/subscribe`
Registra o aggiorna la subscription push di un dispositivo. Accetta sia payload Web Push (VAPID) che token FCM nativo. Autenticazione tramite Bearer token Supabase.

### `GET /api/push/vapid-public-key`
Restituisce la chiave pubblica VAPID per la sottoscrizione Web Push lato client.

### `GET /api/push/cron` *(protetto da `CRON_SECRET`)*
Eseguito ogni minuto da cron-job.org. Esegue due task:

**Task 1 — Promemoria dose:**
- Trova piani con orario nell'ultima mezz'ora non ancora assunti
- Per ogni dispositivo registrato: invia push FCM (Android/iOS) o Web Push (browser)
- Invia anche messaggio Telegram all'utente all'orario esatto della dose (una sola volta, con deduplication su `telegram_user_reminder`)

**Task 2 — Alert mancata assunzione:**
- Trova piani il cui orario supera la soglia `missed_dose_alert_hours`
- Invia (con deduplication) su tutti i canali abilitati: email caregiver, Telegram utente, Telegram caregiver

### `POST /api/telegram/webhook`
Riceve messaggi dal bot Telegram. Gestisce il comando `/start MF-XXXXXX` per collegare l'account Telegram all'utente MemoFarmaci verificando il token temporaneo nel database.

### `POST /api/auth/telegram-link`
Genera un codice `MF-XXXXXX` con scadenza 10 minuti e lo salva in `user_profiles.telegram_link_token`.

### `GET /api/auth/telegram-link-status`
Verifica se il link Telegram è stato completato (polling dalla SettingsPage).

### `POST /api/alerts/send-email`
Invia email al caregiver tramite Resend.

### `POST /api/alerts/send-telegram`
Invia messaggio Telegram al caregiver.

---

## 8. Sistema di Notifiche

### Web Push (browser / PWA)
- Service Worker custom (`src/sw.ts`) gestisce l'evento `push`
- Se l'app è in background: mostra notifica di sistema e invia messaggio `ALARM_PUSH` all'app
- Se l'app è chiusa: apre l'URL con `?alarm=planId` per triggerare l'allarme alla riapertura
- `App.tsx` ascolta messaggi dal SW tramite `navigator.serviceWorker.addEventListener('message')`

### Push Nativa FCM (Android / iOS via Capacitor)
- `usePushNotifications.ts` registra il dispositivo con `PushNotifications.register()`
- Token FCM ricevuto nell'evento `registration` → salvato su backend
- **Notification channel Android** (`memofarmaci-alarms`) con `importance: 5` (IMPORTANCE_HIGH) per garantire suono e heads-up notification su Android 8+
- Evento `pushNotificationReceived` (foreground) → `onAlarm(planId)` → apre AlarmModal con audio
- Evento `pushNotificationActionPerformed` (tap su notifica da background) → `onAlarm(planId)`
- **Deep link:** `CapApp.addListener('appUrlOpen')` legge `?alarm=planId` quando l'app viene aperta da notifica FCM
- Il cron specifica `android.priority: 'high'` e `android.notification.channelId` per consegna immediata anche in Doze mode

---

## 9. Progressive Web App (PWA)

- `vite-plugin-pwa` in modalità `injectManifest`: il SW è scritto manualmente in `src/sw.ts`
- Precaching di tutti gli asset statici (JS, CSS, HTML, icone)
- Manifest con `display: standalone`, icone 192×192 e 512×512
- Offline banner (`OfflineBanner.tsx`) visibile quando la connessione è assente
- Installabile su Android e iOS tramite "Aggiungi alla schermata Home"

---

## 10. App Android Nativa (Capacitor)

- **App ID:** `it.memofarmaci.app`
- **Capacitor:** versione 7, con plugin `@capacitor/push-notifications` e `@capacitor/app`
- Icone generate con `@capacitor/assets` in tutte le densità (ldpi → xxxhdpi) + adaptive icons Android 8+ + splash screen portrait/landscape
- **Blocco tasto ← Android:** gestito tramite `history.pushState` + `popstate` listener
- **Build:**
  1. `npm run cap:sync` (build Vite + sync asset in `android/`)
  2. `cd android && gradlew.bat assembleDebug`
  3. `adb install -r app\build\outputs\apk\debug\app-debug.apk`
- **Variabili d'ambiente:** devono essere nel `.env.local` al momento del build (Vite le embeds nel bundle JS)

---

## 11. Struttura File Principale

```
memofarmaci/
├── src/
│   ├── App.tsx                    # App principale, logica allarme, routing viste
│   ├── main.tsx                   # Entry point React
│   ├── sw.ts                      # Service Worker custom (PWA)
│   ├── contexts/
│   │   └── AuthContext.tsx        # Provider autenticazione Supabase
│   ├── components/
│   │   ├── AppRouter.tsx          # Gate Login → CompleteProfile → App
│   │   ├── AlarmModal.tsx         # Modal allarme con conferma dose
│   │   ├── AddMedication.tsx      # Form aggiunta/modifica farmaco
│   │   ├── ScheduleMedication.tsx # Form creazione/modifica piano
│   │   ├── PlanManager.tsx        # Lista piani terapeutici
│   │   ├── MedicationList.tsx     # Lista farmaci
│   │   ├── HistoryLog.tsx         # Storico assunzioni
│   │   ├── SideEffects.tsx        # Log effetti collaterali
│   │   ├── Appointments.tsx       # Gestione appuntamenti
│   │   ├── CropModal.tsx          # Crop foto farmaci
│   │   ├── TelegramLinkCard.tsx   # Card collegamento Telegram
│   │   ├── OfflineBanner.tsx      # Banner offline
│   │   └── Toast.tsx              # Notifiche in-app
│   ├── pages/
│   │   ├── LoginPage.tsx          # Schermata login OAuth
│   │   ├── CompleteProfilePage.tsx# Completamento profilo
│   │   └── SettingsPage.tsx       # Impostazioni e alert
│   ├── hooks/
│   │   ├── usePushNotifications.ts# Gestione push web + FCM nativo
│   │   ├── useMedications.ts      # CRUD farmaci
│   │   ├── useMedicationPlans.ts  # CRUD piani
│   │   ├── useIntakeLogs.ts       # Log assunzioni
│   │   ├── useSideEffects.ts      # Log effetti collaterali
│   │   └── useAppointments.ts     # Gestione appuntamenti
│   └── lib/
│       └── supabase.ts            # Client Supabase
├── api/
│   ├── push/
│   │   ├── cron.ts                # Cron notifiche + alert mancata assunzione
│   │   ├── subscribe.ts           # Registrazione subscription
│   │   └── vapid-public-key.ts    # Chiave VAPID pubblica
│   ├── telegram/
│   │   └── webhook.ts             # Bot Telegram
│   ├── auth/
│   │   ├── telegram-link.ts       # Genera codice MF-XXXXXX
│   │   └── telegram-link-status.ts# Verifica link completato
│   └── alerts/
│       ├── send-email.ts          # Email via Resend
│       └── send-telegram.ts       # Messaggio Telegram
├── supabase/migrations/
│   ├── 001_initial_schema.sql     # Schema completo + RLS + Storage
│   ├── 002_add_telegram_reminder_channel.sql
│   └── 003_fcm_tokens.sql         # Aggiunge fcm_token a push_subscriptions
├── android/                       # Progetto Android Capacitor
├── assets/icon.png                # Icona sorgente 512×512
├── public/icons/                  # Icone PWA
├── capacitor.config.ts            # Config Capacitor
└── vite.config.ts                 # Config Vite + PWA
```

---

## 12. Variabili d'Ambiente

### Vercel (build + runtime server)
| Variabile | Descrizione |
|---|---|
| `VITE_SUPABASE_URL` | URL progetto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chiave pubblica Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chiave service role (solo server) |
| `VAPID_PUBLIC_KEY` | Chiave pubblica VAPID |
| `VAPID_PRIVATE_KEY` | Chiave privata VAPID |
| `VAPID_EMAIL` | Email mittente VAPID (`mailto:...`) |
| `CRON_SECRET` | Segreto per autenticare il cron |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram |
| `TELEGRAM_BOT_USERNAME` | Username bot (es. `MemoFarmaciBot`) |
| `RESEND_API_KEY` | Chiave API Resend |
| `RESEND_FROM_EMAIL` | Email mittente |
| `FIREBASE_ADMIN_KEY` | JSON service account Firebase (su una riga) |
| `VITE_APP_URL` | URL app per deep link nei messaggi Telegram |

### `.env.local` (build Android locale)
Devono essere presenti `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` perché Vite le embedded nel bundle JS al momento della compilazione.

---

## 13. Passi di Deploy e Configurazione

### Prima installazione
1. Creare progetto Supabase ed eseguire le 3 migration in ordine
2. Abilitare OAuth Google + Facebook in Supabase → Auth → Providers
3. Impostare Site URL e Redirect URL su `https://memofarmaci-wm25.vercel.app`
4. Configurare tutte le variabili d'ambiente su Vercel
5. Creare progetto Firebase, scaricare `google-services.json`, configurare `FIREBASE_ADMIN_KEY`
6. Deploy su Vercel (collegato al branch `main` o `development`)
7. Registrare webhook Telegram:
   ```
   GET https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://memofarmaci-wm25.vercel.app/api/telegram/webhook
   ```
8. Configurare cron-job.org per chiamare `/api/push/cron?secret=...` ogni minuto

### Build app Android
```bash
# 1. Assicurarsi di avere .env.local con VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
# 2. Copiare google-services.json in android/app/
npm run cap:sync
cd android && gradlew.bat assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

---

## 14. Scelte Architetturali Notevoli

| Problema | Soluzione adottata |
|---|---|
| Cron Vercel Hobby (max 1/giorno) | cron-job.org chiama l'endpoint ogni minuto |
| Push multi-dispositivo senza Redis | Tabella `push_subscriptions` su Supabase |
| Deduplication alert | Tabella `alert_sent_log` con vincolo UNIQUE |
| Suono allarme su mobile | Web Audio API (`AudioContext`) invece di file MP3 |
| Push nativa Android 8+ senza suono | Notification channel `memofarmaci-alarms` con `importance: 5` |
| AudioContext bloccato su Android | `ctx.resume()` esplicito prima dell'uso |
| Timezone errata per data corrente | Calcolo con componenti locali invece di `toISOString()` (UTC) |
| `navigator.locks` timeout in SW | Lock bypassato nel client Supabase con funzione identity |
| Variabili Vite mancanti in APK Android | Aggiungere `VITE_*` nel `.env.local` prima del build locale |
