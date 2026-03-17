// ============================================================
// MemoFarmaci - Tipi condivisi
// ============================================================

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  birthDate?: string;             // YYYY-MM-DD
  postalCode?: string;
  caregiverName?: string;
  caregiverPhone?: string;
  caregiverEmail?: string;
  alertEmailEnabled: boolean;
  alertTelegramUserEnabled: boolean;
  alertTelegramCaregiverEnabled: boolean;
  telegramUserChatId?: string;
  telegramCaregiverChatId?: string;
  missedDoseAlertHours: number;
  profileCompleted: boolean;
  // Consenso GDPR (obbligatorio al primo accesso)
  privacyPolicyAcceptedAt?: string;   // ISO 8601 — null = mai accettata
  healthDataConsentAt?: string;        // ISO 8601 — null = mai dato consenso art. 9
  privacyPolicyVersion?: string;       // Es. "1.0"
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  boxPhotoPath?: string;   // path in Supabase Storage
  pillPhotoPath?: string;
  boxPhoto?: string;       // URL firmato per la visualizzazione
  pillPhoto?: string;      // URL firmato per la visualizzazione
  createdAt?: string;
}

export type Frequency = 'daily' | 'alternate';

export interface MedicationPlan {
  id: string;
  userId: string;
  medicationId: string;
  time: string;            // HH:MM
  dosage: string;
  frequency: Frequency;
  startDate: string;       // YYYY-MM-DD
  endDate: string;         // YYYY-MM-DD
  createdAt?: string;
}

export interface TodaysScheduleItem {
  id: string;             // "{planId}-{todayStr}"
  planId: string;
  medicationId: string;
  time: string;
  dosage: string;
  taken: boolean;
}

export interface IntakeLog {
  id: string;
  userId: string;
  planId: string;
  medicationId: string;
  scheduleTime: string;    // HH:MM
  scheduleDate: string;    // YYYY-MM-DD
  takenAt?: string;        // ISO 8601
}

export interface SideEffect {
  id: string;
  userId: string;
  medicationId: string;
  description: string;
  occurredAt: string;      // ISO 8601
}

export interface Appointment {
  id: string;
  userId: string;
  doctor: string;
  location: string;
  dateTime: string;        // ISO 8601
  createdAt?: string;
}
