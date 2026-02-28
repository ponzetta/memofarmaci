import type { VercelRequest, VercelResponse } from '@vercel/node';

// Ponte OAuth per Android: Supabase redirige qui dopo il login Google/Facebook,
// e noi facciamo subito redirect al custom scheme dell'app nativa.
// Il Chrome Custom Tab di Capacitor intercetta it.memofarmaci.app:// e chiude il browser,
// restituendo il controllo all'app che scambia il code con la sessione.
const APP_SCHEME = 'it.memofarmaci.app://login';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') params.set(key, value);
  }

  const redirectUrl = `${APP_SCHEME}?${params.toString()}`;

  // In caso di errore OAuth mostra una pagina minimale invece di un redirect rotto
  if (req.query.error) {
    return res.status(400).send(`<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><title>Errore login</title></head>
<body style="font-family:sans-serif;text-align:center;padding:2rem">
  <h2>Errore di autenticazione</h2>
  <p>${req.query.error_description ?? req.query.error}</p>
  <p><a href="${redirectUrl}">Torna all'app</a></p>
</body></html>`);
  }

  // Redirect 302 verso il custom scheme — Android lo intercetta e apre l'app
  return res.redirect(302, redirectUrl);
}
