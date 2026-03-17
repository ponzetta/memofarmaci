# Fastlane – Play Store Setup

## Prerequisiti

1. **Ruby** (>= 2.7): `ruby --version`
2. **Fastlane**: `gem install fastlane`
3. **Chiave Google Play API** (Service Account JSON):
   - Play Console → Setup → API access → Create Service Account
   - Salva il JSON come `fastlane/google-play-key.json` (non committare!)
   - Aggiungi `.gitignore`: `fastlane/google-play-key.json`

## Struttura metadati

```
fastlane/
  Appfile                          # Package name + percorso chiave JSON
  Fastfile                         # Lane: metadata / internal / promote_beta / promote_production
  metadata/
    android/
      it-IT/                       # Italiano (lingua principale)
        title.txt                  # Max 50 caratteri
        short_description.txt      # Max 80 caratteri
        full_description.txt       # Max 4000 caratteri
        changelogs/
          1.txt                    # Note versione per versionCode 1
        images/
          icon.png                 # 512x512 px
          featureGraphic.png       # 1024x500 px
          phoneScreenshots/        # Screenshot telefono (PNG/JPEG, 1080x1920 consigliato)
      en-US/                       # Inglese
        (stessa struttura)
```

## Workflow pubblicazione

### 1. Prima pubblicazione (manuale su Play Console)
La prima volta il build firmato va caricato manualmente:
- Android Studio → Build → Generate Signed Bundle/APK → AAB
- Play Console → Crea app → Internal Testing → Carica AAB

### 2. Upload metadati e screenshot
```bash
cd /path/to/memofarmaci
fastlane metadata
```

### 3. Nuova versione (aggiorna versionCode in build.gradle prima)
```bash
# Builda AAB in Android Studio, poi:
fastlane internal          # carica in Internal Testing
fastlane promote_beta      # promuovi a Open Testing
fastlane promote_production # promuovi a Produzione
```

## Configurazione Play Console (passi manuali)

| Campo | Valore |
|-------|--------|
| Nome app | MemoFarmaci - Promemoria Farmaci |
| Categoria | Medicina |
| Tag | promemoria farmaci, terapia, caregiver, salute |
| Email contatto | (inserire email sviluppatore) |
| Sito web | https://memofarmaci-wm25.vercel.app |
| Privacy policy | https://memofarmaci-wm25.vercel.app/privacy |
| Valutazione contenuti | Tutti (PEGI 3 / E) |
| Target audience | 18+ (pazienti adulti) |
| Contiene annunci | No |
| Acquisti in-app | No |

## Permessi da dichiarare nella scheda

| Permesso | Motivo |
|---------|--------|
| `INTERNET` | Sincronizzazione dati cloud e login |
| `POST_NOTIFICATIONS` | Invio promemoria farmaci |
| `USE_EXACT_ALARM` | Allarmi precisi all'orario della terapia |
| `SCHEDULE_EXACT_ALARM` | Allarmi precisi (Android 12) |
| `WAKE_LOCK` | Mantenere la CPU attiva durante l'allarme |
| `USE_FULL_SCREEN_INTENT` | Mostrare l'allarme sulla lock screen |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Garantire allarmi con risparmio energetico |
| `CAMERA` (WebView) | Fotografare scatola/pillola del farmaco |

## Note importanti
- `google-play-key.json` NON va nel repository (aggiunto a `.gitignore`)
- Aggiorna `changelogs/<versionCode>.txt` ad ogni nuova versione
- Il `featureGraphic.png` è obbligatorio per pubblicare in produzione
