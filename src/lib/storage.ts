import { supabase } from './supabase';

const BUCKET = 'medication-photos';
const SIGNED_URL_EXPIRY = 60 * 60; // 1 ora

/**
 * Carica una foto sul bucket Supabase Storage.
 * Restituisce il path relativo (es. "{userId}/{uuid}.jpg").
 */
export async function uploadPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${userId}/${filename}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) throw new Error(`Upload foto fallito: ${error.message}`);
  return path;
}

/**
 * Genera un URL firmato con validità 1 ora per visualizzare la foto.
 */
export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    throw new Error(`Generazione URL firmato fallita: ${error?.message}`);
  }
  return data.signedUrl;
}

/**
 * Elimina una foto dallo Storage.
 */
export async function deletePhoto(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Eliminazione foto fallita: ${error.message}`);
}

/**
 * Risolve più path in signed URL in parallelo. Ignora path undefined/null.
 */
export async function resolvePhotoUrls(
  paths: (string | undefined | null)[]
): Promise<(string | undefined)[]> {
  return Promise.all(
    paths.map(async (p) => {
      if (!p) return undefined;
      try {
        return await getSignedUrl(p);
      } catch {
        return undefined;
      }
    })
  );
}
