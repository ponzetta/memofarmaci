import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Frequency, MedicationPlan } from '../types';

type DbRow = {
  id: string;
  user_id: string;
  medication_id: string;
  time: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

function mapRow(row: DbRow): MedicationPlan {
  return {
    id: row.id,
    userId: row.user_id,
    medicationId: row.medication_id,
    time: row.time,
    dosage: row.dosage,
    frequency: row.frequency as Frequency,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  };
}

export function useMedicationPlans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<MedicationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('medication_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setPlans((data as DbRow[]).map(mapRow));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function savePlan(planData: Omit<MedicationPlan, 'userId' | 'createdAt'>): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');

    const dbData = {
      id: planData.id,
      user_id: user.id,
      medication_id: planData.medicationId,
      time: planData.time,
      dosage: planData.dosage,
      frequency: planData.frequency,
      start_date: planData.startDate,
      end_date: planData.endDate,
    };

    const existing = plans.find(p => p.id === planData.id);

    if (existing) {
      const { data, error } = await supabase
        .from('medication_plans')
        .update(dbData)
        .eq('id', planData.id)
        .select()
        .single();
      if (error) throw error;
      setPlans(prev => prev.map(p => p.id === planData.id ? mapRow(data as DbRow) : p));
    } else {
      const { data, error } = await supabase
        .from('medication_plans')
        .insert(dbData)
        .select()
        .single();
      if (error) throw error;
      setPlans(prev => [...prev, mapRow(data as DbRow)]);
    }
  }

  async function deletePlan(id: string): Promise<void> {
    const { error } = await supabase.from('medication_plans').delete().eq('id', id);
    if (error) throw error;
    setPlans(prev => prev.filter(p => p.id !== id));
  }

  return { plans, loading, error, savePlan, deletePlan, reload: load };
}
