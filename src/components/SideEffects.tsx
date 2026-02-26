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
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-serif text-slate-800">Effetti Collaterali</h2>
        <button onClick={onClose} className="text-2xl font-sans text-gray-500 hover:text-gray-800">&times;</button>
      </header>
      
      {/* Form per aggiungere */}
      <section className="mb-8 p-4 border rounded-lg">
        <h3 class="text-xl font-serif mb-4">Registra Nuovo</h3>
        <div className="space-y-4">
          <select 
            value={selectedMed}
            onChange={(e) => setSelectedMed(e.target.value)}
            className="w-full p-3 border-2 border-gray-200 rounded-lg bg-white text-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
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
            className="w-full p-3 border-2 border-gray-200 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
          />
          <div className="flex gap-4">
            <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg text-lg font-bold">Annulla</button>
            <button onClick={handleSubmit} className="w-full bg-[#5A5A40] text-white py-3 rounded-lg text-lg font-bold">Salva</button>
          </div>
        </div>
      </section>

      {/* Cronologia */}
      <main className="flex-grow overflow-y-auto">
        <h3 class="text-xl font-serif mb-4">Cronologia</h3>
        {sideEffects.length === 0 ? (
          <p className="text-center text-slate-500">Nessun effetto registrato.</p>
        ) : (
          <ul className="space-y-3">
            {sideEffects.slice().reverse().map(effect => (
              <li key={effect.id} className="bg-red-50 p-4 rounded-lg">
                <p className="font-bold text-red-800">{getMedicationName(effect.medicationId)}</p>
                <p className="text-slate-700 my-1">{effect.description}</p>
                <p className="text-sm text-slate-500">{formatTimestamp(effect.occurredAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
