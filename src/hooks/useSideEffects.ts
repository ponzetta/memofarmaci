import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { SideEffect } from '../types';

type DbRow = {
  id: string;
  user_id: string;
  medication_id: string;
  description: string;
  occurred_at: string;
};

function mapRow(row: DbRow): SideEffect {
  return {
    id: row.id,
    userId: row.user_id,
    medicationId: row.medication_id,
    description: row.description,
    occurredAt: row.occurred_at,
  };
}

export function useSideEffects() {
  const { user } = useAuth();
  const [sideEffects, setSideEffects] = useState<SideEffect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('side_effects')
        .select('*')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      setSideEffects((data as DbRow[]).map(mapRow));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function addSideEffect(medicationId: string, description: string): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');
    const { data, error } = await supabase
      .from('side_effects')
      .insert({ user_id: user.id, medication_id: medicationId, description })
      .select()
      .single();
    if (error) throw error;
    setSideEffects(prev => [mapRow(data as DbRow), ...prev]);
  }

  async function deleteSideEffect(id: string): Promise<void> {
    const { error } = await supabase.from('side_effects').delete().eq('id', id);
    if (error) throw error;
    setSideEffects(prev => prev.filter(s => s.id !== id));
  }

  return { sideEffects, loading, error, addSideEffect, deleteSideEffect, reload: load };
}
