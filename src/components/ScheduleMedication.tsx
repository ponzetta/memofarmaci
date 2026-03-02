import { useState } from 'react';
import type { Medication, Frequency, MedicationPlan } from '../types';

type PlanDraft = Omit<MedicationPlan, 'userId' | 'createdAt'>;

interface ScheduleMedicationProps {
  medications: Medication[];
  onSavePlan: (plan: PlanDraft) => Promise<void>;
  onClose: () => void;
  existingPlan?: MedicationPlan;
}

export default function ScheduleMedication({ medications, onSavePlan, onClose, existingPlan }: ScheduleMedicationProps) {
  const NO_END_DATE = '2099-12-31';
  const [selectedMed, setSelectedMed] = useState<string>(existingPlan?.medicationId || medications[0]?.id || '');
  const [time, setTime] = useState(existingPlan?.time || '08:00');
  const [dosage, setDosage] = useState(existingPlan?.dosage || '1 compressa');
  const [frequency, setFrequency] = useState<Frequency>(existingPlan?.frequency || 'daily');
  const [startDate, setStartDate] = useState(existingPlan?.startDate || new Date().toISOString().split('T')[0]);
  const [noEndDate, setNoEndDate] = useState(existingPlan?.endDate === NO_END_DATE || !existingPlan?.endDate);
  const [endDate, setEndDate] = useState(existingPlan?.endDate && existingPlan.endDate !== NO_END_DATE ? existingPlan.endDate : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const resolvedEndDate = noEndDate ? NO_END_DATE : endDate;
    if (!selectedMed || !time || !dosage.trim() || !startDate) {
      alert('Per favore, compila tutti i campi obbligatori.');
      return;
    }
    if (!noEndDate && !endDate) {
      alert('Inserisci una data di fine o seleziona "Senza data di fine".');
      return;
    }
    if (!noEndDate && new Date(startDate) > new Date(endDate)) {
      alert('La data di inizio non può essere successiva alla data di fine.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSavePlan({
        id: existingPlan?.id || `p${Date.now()}`,
        medicationId: selectedMed,
        time,
        dosage: dosage.trim(),
        frequency,
        startDate,
        endDate: resolvedEndDate,
      });
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Errore nel salvataggio. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pt-5 pb-4 rounded-b-3xl shadow-lg">
        <h1 className="text-xl font-bold">{existingPlan ? 'Modifica Piano' : 'Pianifica Farmaco'}</h1>
      </header>
      {error && <div className="mx-6 mt-3 mb-2 bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
      <main className="flex-grow flex flex-col justify-center px-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">Farmaco</label>
          <select value={selectedMed} onChange={(e) => setSelectedMed(e.target.value)} className="w-full p-2.5 border-2 rounded-lg bg-white text-sm">
            {medications.map(med => <option key={med.id} value={med.id}>{med.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Inizio Cura</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2.5 border-2 rounded-lg text-sm" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-600">Fine Cura</label>
              <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={noEndDate}
                  onChange={(e) => setNoEndDate(e.target.checked)}
                  className="w-4 h-4 accent-[#0D9488]"
                />
                Senza data di fine
              </label>
            </div>
            {!noEndDate && (
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2.5 border-2 rounded-lg text-sm" />
            )}
            {noEndDate && (
              <p className="p-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-slate-400 italic">Nessuna scadenza</p>
            )}
          </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Frequenza</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="w-full p-2.5 border-2 rounded-lg bg-white text-sm">
                <option value="daily">Ogni giorno</option>
                <option value="alternate">A giorni alterni</option>
            </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Orario</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-2.5 border-2 rounded-lg text-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">Dose</label>
                <input type="text" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Es. 1 compressa" className="w-full p-2.5 border-2 rounded-lg text-sm" />
            </div>
        </div>
      </main>
      <footer className="mt-auto px-6 pb-6">
        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-[#0D9488] text-white text-sm font-semibold py-3 rounded-2xl shadow-lg hover:bg-opacity-90 disabled:opacity-60 transition-all transform active:scale-95"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 text-sm font-semibold py-3 rounded-2xl hover:bg-gray-300 transition-all"
          >
            Annulla
          </button>
        </div>
      </footer>
    </div>
  );
}
