export interface Medication {
  id: string;
  name: string;
  boxPhoto?: string; // Base64 encoded image
  pillPhoto?: string; // Base64 encoded image
}

export type Frequency = 'daily' | 'alternate';

// Rappresenta il piano di una terapia nel tempo
export interface MedicationPlan {
  id: string;
  medicationId: string;
  time: string; // HH:MM format
  dosage: string;
  frequency: Frequency;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

// Rappresenta un farmaco da prendere oggi (generato dinamicamente)
export interface TodaysScheduleItem {
    id: string; // id unico per la voce di oggi (es. plan.id + data)
    planId: string;
    medicationId: string;
    time: string;
    dosage: string;
    taken: boolean;
}

export interface IntakeLog {
  id: string;
  scheduleId: string; // Corrisponde a MedicationPlan.id
  medicationId: string;
  timestamp: string; // ISO 8601 format
  scheduleTime: string; // HH:MM, per distinguere dosi diverse nello stesso giorno
}

export interface SideEffect {
  id: string;
  medicationId: string;
  description: string;
  timestamp: string; // ISO 8601 format
}

export interface Appointment {
  id: string;
  doctor: string;
  location: string;
  dateTime: string; // ISO 8601 format
}

