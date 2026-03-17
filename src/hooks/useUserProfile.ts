import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile } from '../types';

// Mappa DB → TS
function mapRow(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    phone: row.phone as string | undefined,
    email: row.email as string | undefined,
    birthDate: row.birth_date as string | undefined,
    postalCode: row.postal_code as string | undefined,
    caregiverName: row.caregiver_name as string | undefined,
    caregiverPhone: row.caregiver_phone as string | undefined,
    caregiverEmail: row.caregiver_email as string | undefined,
    alertEmailEnabled: row.alert_email_enabled as boolean,
    alertTelegramUserEnabled: row.alert_telegram_user_enabled as boolean,
    alertTelegramCaregiverEnabled: row.alert_telegram_caregiver_enabled as boolean,
    telegramUserChatId: row.telegram_user_chat_id as string | undefined,
    telegramCaregiverChatId: row.telegram_caregiver_chat_id as string | undefined,
    missedDoseAlertHours: row.missed_dose_alert_hours as number,
    profileCompleted: row.profile_completed as boolean,
    privacyPolicyAcceptedAt: row.privacy_policy_accepted_at as string | undefined,
    healthDataConsentAt: row.health_data_consent_at as string | undefined,
    privacyPolicyVersion: row.privacy_policy_version as string | undefined,
  };
}

// Mappa TS → DB (solo campi modificabili)
function mapToDb(profile: Partial<UserProfile>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  if (profile.firstName !== undefined) db.first_name = profile.firstName;
  if (profile.lastName !== undefined) db.last_name = profile.lastName;
  if (profile.phone !== undefined) db.phone = profile.phone;
  if (profile.email !== undefined) db.email = profile.email;
  if (profile.birthDate !== undefined) db.birth_date = profile.birthDate;
  if (profile.postalCode !== undefined) db.postal_code = profile.postalCode;
  if (profile.caregiverName !== undefined) db.caregiver_name = profile.caregiverName;
  if (profile.caregiverPhone !== undefined) db.caregiver_phone = profile.caregiverPhone;
  if (profile.caregiverEmail !== undefined) db.caregiver_email = profile.caregiverEmail;
  if (profile.alertEmailEnabled !== undefined) db.alert_email_enabled = profile.alertEmailEnabled;
  if (profile.alertTelegramUserEnabled !== undefined) db.alert_telegram_user_enabled = profile.alertTelegramUserEnabled;
  if (profile.alertTelegramCaregiverEnabled !== undefined) db.alert_telegram_caregiver_enabled = profile.alertTelegramCaregiverEnabled;
  if (profile.missedDoseAlertHours !== undefined) db.missed_dose_alert_hours = profile.missedDoseAlertHours;
  if (profile.profileCompleted !== undefined) db.profile_completed = profile.profileCompleted;
  if (profile.privacyPolicyAcceptedAt !== undefined) db.privacy_policy_accepted_at = profile.privacyPolicyAcceptedAt;
  if (profile.healthDataConsentAt !== undefined) db.health_data_consent_at = profile.healthDataConsentAt;
  if (profile.privacyPolicyVersion !== undefined) db.privacy_policy_version = profile.privacyPolicyVersion;
  return db;
}

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      setProfile(data ? mapRow(data) : null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  /**
   * Crea o aggiorna il profilo utente.
   * Imposta profile_completed=true quando il profilo è completato.
   */
  async function saveProfile(updates: Partial<UserProfile>): Promise<void> {
    if (!user) throw new Error('Utente non autenticato');
    const dbData = { ...mapToDb(updates), id: user.id };

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(dbData)
      .select()
      .single();

    if (error) throw error;
    setProfile(mapRow(data));
  }

  return { profile, loading, error, saveProfile, reload: loadProfile };
}
