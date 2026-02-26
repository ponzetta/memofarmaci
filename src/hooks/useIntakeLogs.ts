import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { IntakeLog } from '../types';

type DbRow = {
  id: string;
  user_id: string;
  plan_id: string;
  medication_id: string;
  schedule_time: string;
  schedule_date: string;
  taken_at: string;
};

function mapRow(row: DbRow): IntakeLog {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    medicationId: row.medication_id,
    scheduleTime: row.schedule_time,
    scheduleDate: row.schedule_date,
    takenAt: row.taken_at,
  };
}

export function useIntakeLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<IntakeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('intake_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('schedule_date', { ascending: false });
      if (error) throw error;
      setLogs((data as DbRow[]).map(mapRow));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /**
   * Registra un'assunzione. Il UNIQUE su (plan_id, schedule_date, schedule_time)
   * previene doppioni lato DB.
   */
  async function logIntake(
    planId: string,
    medicationId: string,
    scheduleDate: string,
    scheduleTime: string,
  ): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');

    const { data, error } = await supabase
      .from('intake_logs')
      .upsert(
        {
          user_id: user.id,
          plan_id: planId,
          medication_id: medicationId,
          schedule_date: scheduleDate,
          schedule_time: scheduleTime,
        },
        { onConflict: 'plan_id,schedule_date,schedule_time' }
      )
      .select()
      .single();

    if (error) throw error;
    const mapped = mapRow(data as DbRow);
    setLogs(prev => {
      const exists = prev.some(l => l.id === mapped.id);
      return exists ? prev : [mapped, ...prev];
    });
  }

  /**
   * Controlla se un piano è stato assunto oggi.
   */
  function isTakenToday(planId: string, scheduleTime: string, todayStr: string): boolean {
    return logs.some(
      l => l.planId === planId && l.scheduleDate === todayStr && l.scheduleTime === scheduleTime
    );
  }

  return { logs, loading, error, logIntake, isTakenToday, reload: load };
}
