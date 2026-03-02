import { useState } from 'react';
import type { Medication, SideEffect } from '../types';

interface SideEffectsProps {
  medications: Medication[];
  sideEffects: SideEffect[];
  onAddSideEffect: (medicationId: string, description: string) => void;
  onClose: () => void;
}

export default function SideEffects({ medications, sideEffects, onAddSideEffect, onClose }: SideEffectsProps) {
  const [selectedMed, setSelectedMed] = useState<string>(medications[0]?.id || '');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!selectedMed || !description.trim()) {
      alert('Per favore, seleziona un farmaco e descrivi l-effetto collaterale.');
      return;
    }
    onAddSideEffect(selectedMed, description.trim());
    setDescription('');
  };

  const getMedicationName = (id: string) => {
    return medications.find(m => m.id === id)?.name || 'Sconosciuto';
  }

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
  }

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pb-4 rounded-b-3xl shadow-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <h1 className="text-xl font-bold">Effetti Collaterali</h1>
      </header>

      <div className="px-6 pt-3 pb-1 flex justify-end">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 font-medium">&times; Chiudi</button>
      </div>

      {/* Form per aggiungere */}
      <section className="px-6 pb-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Registra Nuovo</p>
        <select
          value={selectedMed}
          onChange={(e) => setSelectedMed(e.target.value)}
          className="w-full p-2.5 border-2 border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
        >
          {medications.map(med => (
            <option key={med.id} value={med.id}>{med.name}</option>
          ))}
        </select>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrivi l'effetto..."
          rows={3}
          className="w-full p-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
        />
        <div className="flex gap-3">
          <button onClick={handleSubmit} className="flex-1 bg-[#0D9488] text-white py-2.5 rounded-xl text-sm font-semibold">Salva</button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">Annulla</button>
        </div>
      </section>

      {/* Cronologia */}
      <main className="flex-grow overflow-y-auto px-6 pb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cronologia</p>
        {sideEffects.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">Nessun effetto registrato.</p>
        ) : (
          <ul className="space-y-2">
            {sideEffects.slice().reverse().map(effect => (
              <li key={effect.id} className="bg-red-50 p-3 rounded-xl">
                <p className="font-semibold text-sm text-red-800">{getMedicationName(effect.medicationId)}</p>
                <p className="text-sm text-slate-700 my-0.5">{effect.description}</p>
                <p className="text-xs text-slate-500">{formatTimestamp(effect.occurredAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
