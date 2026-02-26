import type { Medication, MedicationPlan } from '../types';
import { Plus, Trash2, Pencil } from 'lucide-react';

interface PlanManagerProps {
  plans: MedicationPlan[];
  medications: Medication[];
  onAddNew: () => void;
  onDelete: (planId: string) => void;
  onEdit: (plan: MedicationPlan) => void;
  onClose: () => void;
}

export default function PlanManager({ plans, medications, onAddNew, onDelete, onEdit, onClose }: PlanManagerProps) {
  const getMedicationName = (id: string) => {
    return medications.find(m => m.id === id)?.name || 'Sconosciuto';
  }

  return (
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-serif text-slate-800">Gestione Piani</h2>
        <button onClick={onClose} className="text-2xl font-sans text-gray-500 hover:text-gray-800">&times;</button>
      </header>

      <div className="mb-4 flex gap-4">
        <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 text-xl font-bold py-4 rounded-2xl hover:bg-gray-300 transition-all">
          Chiudi
        </button>
        <button onClick={onAddNew} className="w-full bg-[#5A5A40] text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:bg-opacity-90 flex items-center justify-center gap-2">
          <Plus size={22} />
          Aggiungi
        </button>
      </div>

      <main className="flex-grow overflow-y-auto">
        {plans.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500">Nessun piano terapeutico trovato.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {plans.map(plan => (
              <li key={plan.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg text-slate-800">{getMedicationName(plan.medicationId)}</p>
                  <p className="text-slate-600">{plan.dosage} alle {plan.time}</p>
                  <p className="text-sm text-slate-500">Dal {plan.startDate} al {plan.endDate}</p>
                </div>
                <div className="flex items-center">
                  <button onClick={() => onEdit(plan)} className="text-blue-500 hover:text-blue-700 p-2">
                    <Pencil size={24} />
                  </button>
                  <button onClick={() => onDelete(plan.id)} className="text-red-500 hover:text-red-700 p-2">
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
