import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Appointment } from '../types';

type DbRow = {
  id: string;
  user_id: string;
  doctor: string;
  location: string;
  date_time: string;
  created_at: string;
};

function mapRow(row: DbRow): Appointment {
  return {
    id: row.id,
    userId: row.user_id,
    doctor: row.doctor,
    location: row.location,
    dateTime: row.date_time,
    createdAt: row.created_at,
  };
}

export function useAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('date_time', { ascending: true });
      if (error) throw error;
      setAppointments((data as DbRow[]).map(mapRow));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function addAppointment(doctor: string, location: string, dateTime: string): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');
    const { data, error } = await supabase
      .from('appointments')
      .insert({ user_id: user.id, doctor, location, date_time: dateTime })
      .select()
      .single();
    if (error) throw error;
    const mapped = mapRow(data as DbRow);
    setAppointments(prev => [...prev, mapped].sort((a, b) => a.dateTime.localeCompare(b.dateTime)));
  }

  async function deleteAppointment(id: string): Promise<void> {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) throw error;
    setAppointments(prev => prev.filter(a => a.id !== id));
  }

  return { appointments, loading, error, addAppointment, deleteAppointment, reload: load };
}
