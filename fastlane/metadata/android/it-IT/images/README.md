# Screenshot e immagini Play Store

Posiziona qui i file nella struttura corretta prima di eseguire `fastlane metadata`.

## Struttura attesa da Fastlane Supply

```
images/
  icon.png                      # Icona app 512x512 px (PNG, max 1 MB)
  featureGraphic.png            # Banner feature 1024x500 px
  phoneScreenshots/
    01_home.png                 # Schermata principale con farmaci del giorno
    02_alarm.png                # Dialog allarme multi-farmaco
    03_plan.png                 # Creazione piano terapeutico
    04_history.png              # Storico assunzioni
    05_settings.png             # Impostazioni caregiver / Telegram
  sevenInchScreenshots/         # Tablet 7" (opzionale)
  tenInchScreenshots/           # Tablet 10" (opzionale)
```

## Requisiti screenshot telefono
- Formato: PNG o JPEG
- Dimensioni: minimo 320 px, massimo 3840 px per lato
- Rapporto: tra 16:9 e 9:16
- Consigliato: 1080x1920 px (portrait) o 1080x2340 px

## Requisiti featureGraphic
- Esattamente 1024x500 px, PNG o JPEG

## Suggerimenti contenuto screenshot
1. **Home** – schermata con 2-3 farmaci in elenco, uno in arancione (in scadenza)
2. **Allarme** – dialog con due farmaci, uno già confermato (verde) e uno da confermare
3. **Piano** – form di aggiunta piano con foto farmaco e selezione orario
4. **Storico** – lista assunzioni dell'ultima settimana con spunta verde
5. **Impostazioni** – sezione caregiver con email e Telegram configurati
