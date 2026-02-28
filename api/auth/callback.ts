import type { VercelRequest, VercelResponse } from '@vercel/node';

// Ponte OAuth per Android: Supabase redirige qui dopo il login Google/Facebook,
// e noi facciamo subito redirect al custom scheme dell'app nativa.
// Il Chrome Custom Tab di Capacitor intercetta it.memofarmaci.app:// e chiude il browser,
// restituendo il controllo all'app che scambia il code con la sessione.
const APP_PACKAGE = 'it.memofarmaci.app';
const APP_SCHEME = 'it.memofarmaci.app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') params.set(key, value);
  }

  const queryString = params.toString();

  // Intent URL: Chrome lo intercetta e apre l'app direttamente senza passare
  // per il custom scheme (che Chrome ignora via window.location.href).
  // Formato: intent://[host][path]?[query]#Intent;scheme=...;package=...;end
  const intentUrl = `intent://login?${queryString}#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};end`;

  // Custom scheme come fallback per browser non-Chrome
  const customSchemeUrl = `${APP_SCHEME}://login?${queryString}`;

  if (req.query.error) {
    return res.status(400).send(`<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><title>Errore login</title></head>
<body style="font-family:sans-serif;text-align:center;padding:2rem">
  <h2>Errore di autenticazione</h2>
  <p>${req.query.error_description ?? req.query.error}</p>
  <p><a href="${intentUrl}">Torna all'app</a></p>
</body></html>`);
  }

  // Tenta prima il custom scheme (funziona su WebView/alcuni browser),
  // poi fallback all'intent URL (funziona su Chrome).
  return res.status(200).send(`<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><title>Accesso in corso...</title>
<script>
  // Prima prova il custom scheme
  window.location.href = ${JSON.stringify(customSchemeUrl)};
  // Dopo 500ms, se siamo ancora qui, usa l'intent URL (Chrome)
  setTimeout(function() {
    window.location.href = ${JSON.stringify(intentUrl)};
  }, 500);
</script>
</head>
<body style="font-family:sans-serif;text-align:center;padding:2rem">
  <p>Accesso in corso, attendi...</p>
  <p style="margin-top:1rem">
    <a href="${intentUrl}" style="display:inline-block;margin:0.5rem;padding:0.8rem 1.5rem;background:#5A5A40;color:white;border-radius:8px;text-decoration:none;font-weight:bold">
      Apri MemoFarmaci
    </a>
  </p>
</body></html>`);
}
