import type { Medication } from '../types';
import { Plus, Pencil, Trash2 } from 'lucide-react';

interface MedicationListProps {
  medications: Medication[];
  onAdd: () => void;
  onEdit: (med: Medication) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function MedicationList({ medications, onAdd, onEdit, onDelete, onClose }: MedicationListProps) {
  return (
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-serif text-slate-800">I miei Farmaci</h2>
        <button onClick={onClose} className="text-2xl font-sans text-gray-500 hover:text-gray-800">&times;</button>
      </header>

      <div className="mb-4 flex gap-4">
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 bg-[#5A5A40] text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:bg-opacity-90"
        >
          <Plus size={24} />
          Aggiungi Farmaco
        </button>
        <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 text-xl font-bold py-4 rounded-2xl hover:bg-gray-300 transition-all">
          Chiudi
        </button>
      </div>

      <main className="flex-grow overflow-y-auto">
        {medications.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500">Nessun farmaco salvato.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {medications.map(med => (
              <li key={med.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {med.pillPhoto && (
                    <img src={med.pillPhoto} alt={med.name} className="w-14 h-14 object-cover rounded-lg shadow-sm" />
                  )}
                  <p className="font-bold text-xl text-slate-800">{med.name}</p>
                </div>
                <div className="flex items-center">
                  <button onClick={() => onEdit(med)} className="text-blue-500 hover:text-blue-700 p-2">
                    <Pencil size={24} />
                  </button>
                  <button onClick={() => onDelete(med.id)} className="text-red-500 hover:text-red-700 p-2">
                    <Trash2 size={24} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

    </div>
  );
}
