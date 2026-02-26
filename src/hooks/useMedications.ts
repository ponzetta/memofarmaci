import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uploadPhoto, deletePhoto, resolvePhotoUrls } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import type { Medication } from '../types';

type DbRow = {
  id: string;
  user_id: string;
  name: string;
  box_photo_path: string | null;
  pill_photo_path: string | null;
  created_at: string;
};

async function mapRow(row: DbRow): Promise<Medication> {
  const [boxPhotoUrl, pillPhotoUrl] = await resolvePhotoUrls([
    row.box_photo_path,
    row.pill_photo_path,
  ]);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    boxPhotoPath: row.box_photo_path ?? undefined,
    pillPhotoPath: row.pill_photo_path ?? undefined,
    boxPhoto: boxPhotoUrl,
    pillPhoto: pillPhotoUrl,
    createdAt: row.created_at,
  };
}

export function useMedications() {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const mapped = await Promise.all((data as DbRow[]).map(mapRow));
      setMedications(mapped);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function addMedication(name: string, boxFile?: File, pillFile?: File): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');
    const boxPhotoPath = boxFile ? await uploadPhoto(user.id, boxFile) : null;
    const pillPhotoPath = pillFile ? await uploadPhoto(user.id, pillFile) : null;

    const { data, error } = await supabase
      .from('medications')
      .insert({ user_id: user.id, name, box_photo_path: boxPhotoPath, pill_photo_path: pillPhotoPath })
      .select()
      .single();

    if (error) throw error;
    const mapped = await mapRow(data as DbRow);
    setMedications(prev => [...prev, mapped]);
  }

  async function updateMedication(
    id: string,
    name: string,
    boxFile?: File | null,
    pillFile?: File | null,
    keepBoxPhoto?: boolean,
    keepPillPhoto?: boolean,
  ): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');
    const existing = medications.find(m => m.id === id);

    // Elimina vecchie foto se sostituite
    if (boxFile && existing?.boxPhotoPath) await deletePhoto(existing.boxPhotoPath).catch(() => {});
    if (pillFile && existing?.pillPhotoPath) await deletePhoto(existing.pillPhotoPath).catch(() => {});

    const box_photo_path = boxFile
      ? await uploadPhoto(user.id, boxFile)
      : keepBoxPhoto
        ? (existing?.boxPhotoPath ?? null)
        : null;

    const pill_photo_path = pillFile
      ? await uploadPhoto(user.id, pillFile)
      : keepPillPhoto
        ? (existing?.pillPhotoPath ?? null)
        : null;

    const { data, error } = await supabase
      .from('medications')
      .update({ name, box_photo_path, pill_photo_path })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    const mapped = await mapRow(data as DbRow);
    setMedications(prev => prev.map(m => m.id === id ? mapped : m));
  }

  async function deleteMedication(id: string): Promise<void> {
    const existing = medications.find(m => m.id === id);
    if (existing?.boxPhotoPath) await deletePhoto(existing.boxPhotoPath).catch(() => {});
    if (existing?.pillPhotoPath) await deletePhoto(existing.pillPhotoPath).catch(() => {});

    const { error } = await supabase.from('medications').delete().eq('id', id);
    if (error) throw error;
    setMedications(prev => prev.filter(m => m.id !== id));
  }

  return { medications, loading, error, addMedication, updateMedication, deleteMedication, reload: load };
}
