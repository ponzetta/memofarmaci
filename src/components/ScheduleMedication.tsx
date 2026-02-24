import { useState } from 'react';
import type { Medication, Frequency } from '../types';

interface ScheduleMedicationProps {
  medications: Medication[];
  onAddPlan: (plan: {medicationId: string, time: string, dosage: string, frequency: Frequency, startDate: string, endDate: string}) => void;
  onClose: () => void;
}

export default function ScheduleMedication({ medications, onAddPlan, onClose }: ScheduleMedicationProps) {
  const [selectedMed, setSelectedMed] = useState<string>(medications[0]?.id || '');
  const [time, setTime] = useState('08:00');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');


  const handleSubmit = () => {
    if (!selectedMed || !time || !dosage.trim() || !startDate || !endDate) {
      alert('Per favore, compila tutti i campi.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert('La data di inizio non può essere successiva alla data di fine.');
      return;
    }
    onAddPlan({ medicationId: selectedMed, time, dosage: dosage.trim(), frequency, startDate, endDate });
  };

  return (
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-serif text-slate-800">Pianifica Farmaco</h2>
        <button onClick={onClose} className="text-2xl font-sans text-gray-500 hover:text-gray-800">&times;</button>
      </header>
      <main className="flex-grow flex flex-col justify-center space-y-4">
        <div>
          <label className="block text-lg font-medium text-slate-600 mb-2">Farmaco</label>
          <select value={selectedMed} onChange={(e) => setSelectedMed(e.target.value)} className="w-full p-3 border-2 rounded-lg bg-white text-lg">
            {medications.map(med => <option key={med.id} value={med.id}>{med.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-lg font-medium text-slate-600 mb-2">Inizio Cura</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 border-2 rounded-lg text-lg" />
          </div>
          <div>
            <label className="block text-lg font-medium text-slate-600 mb-2">Fine Cura</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 border-2 rounded-lg text-lg" />
          </div>
        </div>
        <div>
            <label className="block text-lg font-medium text-slate-600 mb-2">Frequenza</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="w-full p-3 border-2 rounded-lg bg-white text-lg">
                <option value="daily">Ogni giorno</option>
                <option value="alternate">A giorni alterni</option>
            </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-lg font-medium text-slate-600 mb-2">Orario</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full p-3 border-2 rounded-lg text-lg" />
            </div>
            <div>
                <label className="block text-lg font-medium text-slate-600 mb-2">Dose</label>
                <input type="text" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Es. 1 compressa" className="w-full p-3 border-2 rounded-lg text-lg" />
            </div>
        </div>
      </main>
      <footer className="mt-auto">
        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 text-xl font-bold py-5 rounded-2xl hover:bg-gray-300 transition-all"
          >
            Annulla
          </button>
          <button 
            onClick={handleSubmit}
            className="w-full bg-[#5A5A40] text-white text-xl font-bold py-5 rounded-2xl shadow-lg hover:bg-opacity-90 transition-all transform active:scale-95"
          >
            Aggiungi al Piano
          </button>
        </div>
      </footer>
    </div>
  );
}
