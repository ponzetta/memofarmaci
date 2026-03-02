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
  }

  return (
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-serif text-slate-800">Appuntamenti Medici</h2>
        <button onClick={onClose} className="text-2xl font-sans text-gray-500 hover:text-gray-800">&times;</button>
      </header>

      <section className="mb-8 p-4 border rounded-lg">
        <h3 class="text-xl font-serif mb-4">Nuovo Appuntamento</h3>
        <div className="space-y-4">
          <input type="text" value={doctor} onChange={e => setDoctor(e.target.value)} placeholder="Nome del Medico" className="w-full p-3 border-2 rounded-lg" />
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Luogo" className="w-full p-3 border-2 rounded-lg" />
          <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} className="w-full p-3 border-2 rounded-lg" />
          <div className="flex gap-4">
            <button onClick={onClose} className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg text-lg font-bold">Annulla</button>
            <button onClick={handleSubmit} className="w-full bg-[#0D9488] text-white py-3 rounded-lg text-lg font-bold">Salva Appuntamento</button>
          </div>
        </div>
      </section>

      <main className="flex-grow overflow-y-auto">
        <h3 class="text-xl font-serif mb-4">Appuntamenti Futuri</h3>
        {appointments.length === 0 ? (
          <p className="text-center text-slate-500">Nessun appuntamento in programma.</p>
        ) : (
          <ul className="space-y-3">
            {appointments.slice().sort((a,b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).map(app => (
              <li key={app.id} className="bg-blue-50 p-4 rounded-lg">
                <p className="font-bold text-blue-800">Dr. {app.doctor}</p>
                <p className="text-slate-700">{app.location}</p>
                <p className="text-slate-600 font-medium mt-1">{formatDateTime(app.dateTime)}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
