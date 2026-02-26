import type { IntakeLog, Medication } from '../types';

interface HistoryLogProps {
  logs: IntakeLog[];
  medications: Medication[];
  onClose: () => void;
}

export default function HistoryLog({ logs, medications, onClose }: HistoryLogProps) {
  const getMedicationName = (id: string) => {
    return medications.find(m => m.id === id)?.name || 'Sconosciuto';
  }

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-serif text-slate-800">Cronologia Assunzioni</h2>
        <button onClick={onClose} className="bg-gray-200 text-gray-800 text-lg font-bold px-5 py-2 rounded-2xl hover:bg-gray-300 transition-all">
          Chiudi
        </button>
      </header>
      <main className="flex-grow overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-center text-slate-500 mt-10">Nessuna assunzione registrata.</p>
        ) : (
          <ul className="space-y-4">
            {logs.slice().reverse().map(log => (
              <li key={log.id} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                <p className="font-bold text-lg text-slate-700">{getMedicationName(log.medicationId)}</p>
                <p className="text-slate-600">Preso il: {formatTimestamp(log.takenAt ?? log.scheduleDate)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
