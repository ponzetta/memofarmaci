import { useState } from 'react';
import type { Appointment } from '../types';

interface AppointmentsProps {
  appointments: Appointment[];
  onAddAppointment: (doctor: string, location: string, dateTime: string) => void;
  onClose: () => void;
}

export default function Appointments({ appointments, onAddAppointment, onClose }: AppointmentsProps) {
  const [doctor, setDoctor] = useState('');
  const [location, setLocation] = useState('');
  const [dateTime, setDateTime] = useState('');

  const handleSubmit = () => {
    if (!doctor.trim() || !location.trim() || !dateTime) {
      alert('Per favore, compila tutti i campi.');
      return;
    }
    onAddAppointment(doctor.trim(), location.trim(), dateTime);
    setDoctor('');
    setLocation('');
    setDateTime('');
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('it-IT', { dateStyle: 'full', timeStyle: 'short' });
  };

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pt-5 pb-4 rounded-b-3xl shadow-lg">
        <h1 className="text-xl font-bold">Appuntamenti Medici</h1>
      </header>

      <div className="px-6 pt-3 pb-1 flex justify-end">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 font-medium">&times; Chiudi</button>
      </div>

      <div className="px-6 pb-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nuovo Appuntamento</p>
        <input type="text" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Nome del Medico" className="w-full p-2.5 border-2 rounded-lg text-sm" />
        <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Luogo" className="w-full p-2.5 border-2 rounded-lg text-sm" />
        <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} className="w-full p-2.5 border-2 rounded-lg text-sm" />
        <div className="flex gap-3">
          <button onClick={handleSubmit} className="flex-1 bg-[#0D9488] text-white py-2.5 rounded-xl text-sm font-semibold">Salva</button>
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-semibold">Annulla</button>
        </div>
      </div>

      <main className="flex-grow overflow-y-auto px-6">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Appuntamenti Futuri</p>
        {appointments.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">Nessun appuntamento in programma.</p>
        ) : (
          <ul className="space-y-2">
            {appointments.slice().sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(app => (
              <li key={app.id} className="bg-blue-50 p-3 rounded-xl">
                <p className="font-semibold text-sm text-blue-800">Dr. {app.doctor}</p>
                <p className="text-sm text-slate-700">{app.location}</p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(app.dateTime)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
