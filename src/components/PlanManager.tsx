import { useState } from 'react';
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const getMedicationName = (id: string) => {
    return medications.find(m => m.id === id)?.name || 'Sconosciuto';
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pb-4 rounded-b-3xl shadow-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <h1 className="text-xl font-bold">Gestione Piani</h1>
      </header>

      <div className="px-6 pt-3 pb-3 flex gap-3">
        <button onClick={onAddNew} className="flex-1 bg-[#0D9488] text-white text-sm font-semibold py-2.5 rounded-xl shadow-lg hover:bg-opacity-90 flex items-center justify-center gap-2">
          <Plus size={18} />
          Aggiungi
        </button>
        <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-all">
          Chiudi
        </button>
      </div>

      <main className="flex-grow overflow-y-auto px-4 pb-4">
        {plans.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-slate-500 text-sm">Nessun piano terapeutico trovato.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {plans.map(plan => (
              <li key={plan.id} className="bg-gray-50 px-4 py-3 rounded-xl">
                {pendingDeleteId === plan.id ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-700 font-medium">
                      Eliminare il piano di <span className="font-bold">{getMedicationName(plan.medicationId)}</span>?
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { onDelete(plan.id); setPendingDeleteId(null); }}
                        className="bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600"
                      >
                        Cancella
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-300"
                      >
                        Annulla
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{getMedicationName(plan.medicationId)}</p>
                      <p className="text-sm text-slate-600">{plan.dosage} alle {plan.time}</p>
                      <p className="text-xs text-slate-500">Dal {plan.startDate}{plan.endDate === '2099-12-31' ? ' · Nessuna scadenza' : ` al ${plan.endDate}`}</p>
                    </div>
                    <div className="flex items-center">
                      <button onClick={() => onEdit(plan)} className="text-blue-500 hover:text-blue-700 p-1.5">
                        <Pencil size={18} />
                      </button>
                      <button onClick={() => setPendingDeleteId(plan.id)} className="text-red-500 hover:text-red-700 p-1.5">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
