import { useState } from 'react';
import type { IntakeLog, Medication } from '../types';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryLogProps {
  logs: IntakeLog[];
  medications: Medication[];
  onClose: () => void;
}

export default function HistoryLog({ logs, medications, onClose }: HistoryLogProps) {
  const getMedicationName = (id: string) => medications.find(m => m.id === id)?.name || 'Sconosciuto';

  // Raggruppa per scheduleDate
  const grouped = logs.reduce<Record<string, IntakeLog[]>>((acc, log) => {
    if (!acc[log.scheduleDate]) acc[log.scheduleDate] = [];
    acc[log.scheduleDate].push(log);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const [openDate, setOpenDate] = useState<string | null>(sortedDates[0] ?? null);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pb-4 rounded-b-3xl shadow-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <h1 className="text-xl font-bold">Cronologia Assunzioni</h1>
      </header>

      <div className="px-6 pt-3 pb-1 flex justify-end">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 font-medium">&times; Chiudi</button>
      </div>

      <main className="flex-grow overflow-y-auto px-4 pb-4">
        {logs.length === 0 ? (
          <p className="text-center text-slate-500 text-sm mt-8">Nessuna assunzione registrata.</p>
        ) : (
          <>
            <div className="space-y-2">
              {sortedDates.map(date => (
                <div key={date} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenDate(openDate === date ? null : date)}
                    className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-semibold text-sm text-slate-700 capitalize">{formatDate(date)}</span>
                    <span className="text-slate-400 ml-2">
                      {openDate === date ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>
                  {openDate === date && (
                    <ul className="divide-y divide-gray-100">
                      {grouped[date].map(log => (
                        <li key={log.id} className="px-4 py-2.5 flex justify-between items-center">
                          <p className="font-medium text-sm text-slate-800">{getMedicationName(log.medicationId)}</p>
                          <p className="text-xs text-slate-500">{log.scheduleTime}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {logs.length > 5 && (
              <div className="pt-4">
                <button onClick={onClose} className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">
                  Chiudi
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
