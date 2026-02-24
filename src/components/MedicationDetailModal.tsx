import type { Medication, TodaysScheduleItem } from '../types';

interface MedicationDetailModalProps {
  scheduleItem: TodaysScheduleItem;
  medication: Medication;
  onClose: () => void;
  onConfirm: () => void;
}

export default function MedicationDetailModal({ scheduleItem, medication, onClose, onConfirm }: MedicationDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 m-4 max-w-md w-full text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-3xl font-bold text-slate-800 mb-4">{medication.name}</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-slate-600 mb-1">Scatola</p>
            <img src={medication.boxPhoto || 'https://picsum.photos/seed/box/400/400'} alt="Scatola" className="w-full h-32 object-contain rounded-lg bg-gray-100 p-1" />
          </div>
          <div>
            <p className="text-slate-600 mb-1">Farmaco</p>
            <img src={medication.pillPhoto || 'https://picsum.photos/seed/pill/400/400'} alt="Pillola" className="w-full h-32 object-contain rounded-lg bg-gray-100 p-1" />
          </div>
        </div>

        <p className="text-2xl text-slate-600 mb-6">Dose: <span className="font-bold">{scheduleItem.dosage}</span></p>

        <div className="flex gap-4">
          <button 
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 text-xl font-bold py-4 rounded-lg hover:bg-gray-300 transition-all"
          >
            Chiudi
          </button>
          {!scheduleItem.taken && (
            <button 
              onClick={onConfirm}
              className="w-full bg-green-600 text-white text-xl font-bold py-4 rounded-lg hover:bg-green-700 transition-all"
            >
              Conferma
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
