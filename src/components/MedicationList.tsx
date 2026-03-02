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
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pb-4 rounded-b-3xl shadow-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <h1 className="text-xl font-bold">I miei Farmaci</h1>
      </header>

      <div className="px-6 pt-3 pb-3 flex gap-3">
        <button
          onClick={onAdd}
          className="flex-1 flex items-center justify-center gap-2 bg-[#0D9488] text-white text-sm font-semibold py-2.5 rounded-xl shadow hover:bg-opacity-90"
        >
          <Plus size={18} />
          Aggiungi
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200">
          Chiudi
        </button>
      </div>

      <main className="flex-grow overflow-y-auto px-4 pb-4">
        {medications.length === 0 ? (
          <p className="text-center text-slate-500 text-sm mt-8">Nessun farmaco salvato.</p>
        ) : (
          <ul className="space-y-2">
            {medications.map(med => (
              <li key={med.id} className="bg-gray-50 px-4 py-3 rounded-xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {med.pillPhoto && (
                    <img src={med.pillPhoto} alt={med.name} className="w-10 h-10 object-cover rounded-lg" />
                  )}
                  <p className="font-semibold text-sm text-slate-800">{med.name}</p>
                </div>
                <div className="flex items-center">
                  <button onClick={() => onEdit(med)} className="text-blue-500 hover:text-blue-700 p-1.5">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => onDelete(med.id)} className="text-red-500 hover:text-red-700 p-1.5">
                    <Trash2 size={18} />
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
