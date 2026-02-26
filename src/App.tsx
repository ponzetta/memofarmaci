import { useMemo, useState, useEffect, useRef } from 'react';
import useLocalStorage from './hooks/useLocalStorage';
import { usePushNotifications } from './hooks/usePushNotifications';
import Toast from './components/Toast';
import type { IntakeLog, SideEffect, Appointment, MedicationPlan, TodaysScheduleItem, Frequency, Medication } from './types';
import { Plus, Bell, Home, FileHeart, CalendarPlus, CalendarClock } from 'lucide-react';
import AddMedication from './components/AddMedication';
import ScheduleMedication from './components/ScheduleMedication';
import PlanManager from './components/PlanManager';
import AlarmModal from './components/AlarmModal';
import HistoryLog from './components/HistoryLog';
import SideEffects from './components/SideEffects';
import Appointments from './components/Appointments';
import MedicationDetailModal from './components/MedicationDetailModal';

const MOCK_MEDICATIONS: Medication[] = [
  { id: '1', name: 'Cardioaspirina' },
  { id: '2', name: 'Lasix' },
  { id: '3', name: 'Torvast' },
];

const MOCK_PLANS: MedicationPlan[] = [
  {
    id: 'p1',
    medicationId: '1',
    time: '08:00',
    dosage: '1 compressa',
    frequency: 'daily',
    startDate: '2023-01-01',
    endDate: '2029-12-31',
  },
  {
    id: 'p2',
    medicationId: '2',
    time: '13:00',
    dosage: '1 compressa',
    frequency: 'alternate',
    startDate: '2023-01-01',
    endDate: '2029-12-31',
  },
];

export default function App() {
  const [medications, setMedications] = useLocalStorage<Medication[]>('medications', MOCK_MEDICATIONS);
  const [medicationPlans, setMedicationPlans] = useLocalStorage<MedicationPlan[]>('medicationPlans', MOCK_PLANS);
  const [currentView, setCurrentView] = useState<'home' | 'addMedication' | 'addPlan' | 'history' | 'sideEffects' | 'appointments' | 'planManager'>('home');
  const [editingPlan, setEditingPlan] = useState<MedicationPlan | undefined>(undefined);
  const [appointments, setAppointments] = useLocalStorage<Appointment[]>('appointments', []);
  const [sideEffects, setSideEffects] = useLocalStorage<SideEffect[]>('sideEffects', []);
  const [intakeLog, setIntakeLog] = useLocalStorage<IntakeLog[]>('intakeLog', []);

  // Calcola lo schedule ad ogni render per la massima affidabilità
  const todayForStr = new Date();
  const year = todayForStr.getFullYear();
  const month = (todayForStr.getMonth() + 1).toString().padStart(2, '0');
  const day = todayForStr.getDate().toString().padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activePlans = medicationPlans.filter(plan => {
    const start = new Date(plan.startDate);
    start.setHours(0,0,0,0);
    const end = new Date(plan.endDate);
    end.setHours(0,0,0,0);

    if (today < start || today > end) return false;
    if (plan.frequency === 'daily') return true;
    if (plan.frequency === 'alternate') {
      const diffTime = Math.abs(today.getTime() - start.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays % 2 === 0;
    }
    return false;
  });

  const todaysSchedule: TodaysScheduleItem[] = activePlans.map(plan => {
    const taken = intakeLog.some(log => {
      const d = new Date(log.timestamp);
      const logDateStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
      return log.medicationId === plan.medicationId && logDateStr === todayStr && log.scheduleTime === plan.time;
    });
    return {
      id: `${plan.id}-${todayStr}`,
      planId: plan.id,
      medicationId: plan.medicationId,
      time: plan.time,
      dosage: plan.dosage,
      taken,
    };
  });

  // Push notifications in background (server-side scheduling)
  const pushSchedule = useMemo(() =>
    todaysSchedule
      .filter(item => !item.taken)
      .map(item => ({
        id: item.id,
        time: item.time,
        name: medications.find(m => m.id === item.medicationId)?.name ?? 'Farmaco',
      })),
  [todaysSchedule, medications]);
  usePushNotifications(pushSchedule);

  // Blocca il tasto ← Android: torna alla home se su una vista secondaria,
  // altrimenti non chiude l'app
  useEffect(() => {
    history.pushState({ pwa: true }, '');

    const onPopState = () => {
      if (currentView !== 'home') {
        setCurrentView('home');
      }
      // Ri-inietta sempre lo stato fittizio per bloccare la chiusura
      history.pushState({ pwa: true }, '');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentView]);

  const [alarmingScheduleId, setAlarmingScheduleId] = useState<string | null>(null);
  const [viewingScheduleId, setViewingScheduleId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (alarmingScheduleId) {
      // --- Audio via Web Audio API ---
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880; // La5
      gain.gain.value = 0;
      osc.start();
      oscillatorRef.current = osc;
      gainRef.current = gain;

      // Pianifica un pattern "bip-bip" ripetuto
      const scheduleBeeps = () => {
        const now = ctx.currentTime;
        const g = gain.gain;
        g.cancelScheduledValues(now);
        // 3 bip da 0.25s separati da 0.15s di silenzio, poi pausa di 0.8s
        [0, 0.4, 0.8].forEach(offset => {
          g.setValueAtTime(0.9, now + offset);
          g.setValueAtTime(0, now + offset + 0.25);
        });
      };
      scheduleBeeps();
      beepIntervalRef.current = setInterval(scheduleBeeps, 1600);

      // --- Vibrazione continua ---
      const vibrate = () => { if ('vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 300]); };
      vibrate();
      vibrateIntervalRef.current = setInterval(vibrate, 1800);

    } else {
      // Stop audio
      if (beepIntervalRef.current) { clearInterval(beepIntervalRef.current); beepIntervalRef.current = null; }
      if (oscillatorRef.current) { try { oscillatorRef.current.stop(); } catch {} oscillatorRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      // Stop vibrazione
      if (vibrateIntervalRef.current) { clearInterval(vibrateIntervalRef.current); vibrateIntervalRef.current = null; }
      if ('vibrate' in navigator) navigator.vibrate(0);
    }

    return () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      if (vibrateIntervalRef.current) clearInterval(vibrateIntervalRef.current);
    };
  }, [alarmingScheduleId]);

  const todaysEvents = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const medicationEvents = todaysSchedule.map(item => ({ ...item, type: 'medication' as const }));
    const appointmentEvents = appointments
      .filter(app => app.dateTime.startsWith(todayStr))
      .map(app => ({
        ...app,
        type: 'appointment' as const,
        time: app.dateTime.split('T')[1].substring(0, 5)
      }));

    const allEvents = [...medicationEvents, ...appointmentEvents];
    allEvents.sort((a, b) => a.time.localeCompare(b.time));
    return allEvents;
  }, [todaysSchedule, appointments]);

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ 
        type: 'SET_SCHEDULE', 
        schedule: todaysEvents 
      });
    }
  }, [todaysEvents]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const dueMed = todaysSchedule.find(item => item.time === currentTime && !item.taken && !alarmingScheduleId);
      if (dueMed) {
        const medication = medications.find(m => m.id === dueMed.medicationId);
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('È ora di prendere la medicina!', {
              body: `Ricordati di prendere ${medication?.name || 'il farmaco'}`,
              icon: medication?.pillPhoto || '/vite.svg',
            });
          }
        });
        setAlarmingScheduleId(dueMed.id);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [todaysSchedule, alarmingScheduleId]);

  const handleAddMedication = (name: string, boxPhoto?: string, pillPhoto?: string) => {
    const newMedication: Medication = { id: (medications.length + 1).toString(), name, boxPhoto, pillPhoto };
    setMedications(currentMeds => [...currentMeds, newMedication]);
    setCurrentView('home');
  };

  const handleSavePlan = (planData: MedicationPlan) => {
    setMedicationPlans(prevPlans => {
      const existingIndex = prevPlans.findIndex(p => p.id === planData.id);
      if (existingIndex > -1) {
        // Update
        const newPlans = [...prevPlans];
        newPlans[existingIndex] = planData;
        return newPlans;
      } else {
        // Add new
        return [...prevPlans, planData];
      }
    });
    setEditingPlan(undefined);
    setCurrentView('planManager');
  };

  const handleEditPlan = (plan: MedicationPlan) => {
    setEditingPlan(plan);
    setCurrentView('addPlan');
  };

  const handleDeletePlan = (planId: string) => {
    setMedicationPlans(prevPlans => prevPlans.filter(p => p.id !== planId));
  };

  const handleAddSideEffect = (medicationId: string, description: string) => {
    const newSideEffect: SideEffect = { id: `se${Date.now()}`, medicationId, description, timestamp: new Date().toISOString() };
    setSideEffects(prev => [...prev, newSideEffect]);
  };

  const handleAddAppointment = (doctor: string, location: string, dateTime: string) => {
    const newAppointment: Appointment = { id: `app${Date.now()}`, doctor, location, dateTime };
    setAppointments(prev => [...prev, newAppointment]);
    setCurrentView('home');
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        const appointmentTime = new Date(dateTime).getTime();
        const notificationTime = appointmentTime - 60 * 60 * 1000;
        const now = new Date().getTime();
        if (notificationTime > now) {
          setTimeout(() => {
            new Notification('Promemoria Appuntamento', {
              body: `Hai un appuntamento con Dr. ${doctor} tra un'ora presso ${location}.`,
              icon: '/vite.svg'
            });
          }, notificationTime - now);
        }
      }
    });
  };

  const getMedicationName = (id: string) => medications.find(m => m.id === id)?.name || 'Sconosciuto';

  const handleToggleTaken = (scheduleItemId: string) => {
    const itemToLog = todaysSchedule.find(item => item.id === scheduleItemId);
    if (itemToLog && !itemToLog.taken) {
      const newLogEntry: IntakeLog = {
        id: `log${Date.now()}`,
        scheduleId: itemToLog.planId,
        medicationId: itemToLog.medicationId,
        timestamp: new Date().toISOString(),
        scheduleTime: itemToLog.time,
      };
      setIntakeLog(prevLog => [...prevLog, newLogEntry]);
      setToastMessage('Assunzione del farmaco registrata, Grazie');
    }
  };

  if (currentView === 'addMedication') return <AddMedication onAddMedication={handleAddMedication} onClose={() => setCurrentView('home')} />;
  if (currentView === 'addPlan') return <ScheduleMedication medications={medications} onSavePlan={handleSavePlan} onClose={() => { setEditingPlan(undefined); setCurrentView('planManager'); }} existingPlan={editingPlan} />;
  if (currentView === 'planManager') return <PlanManager plans={medicationPlans} medications={medications} onAddNew={() => { setEditingPlan(undefined); setCurrentView('addPlan'); }} onEdit={handleEditPlan} onDelete={handleDeletePlan} onClose={() => setCurrentView('home')} />;
  if (currentView === 'history') return <HistoryLog logs={intakeLog} medications={medications} onClose={() => setCurrentView('home')} />;
  if (currentView === 'sideEffects') return <SideEffects medications={medications} sideEffects={sideEffects} onAddSideEffect={handleAddSideEffect} onClose={() => setCurrentView('home')} />;
  if (currentView === 'appointments') return <Appointments appointments={appointments} onAddAppointment={handleAddAppointment} onClose={() => setCurrentView('home')} />;

  const alarmingSchedule = todaysSchedule.find(item => item.id === alarmingScheduleId);
  const alarmingMedication = alarmingSchedule ? medications.find(med => med.id === alarmingSchedule.medicationId) : undefined;
  const viewingSchedule = todaysSchedule.find(item => item.id === viewingScheduleId);
  const viewingMedication = viewingSchedule ? medications.find(med => med.id === viewingSchedule.medicationId) : undefined;

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-white flex flex-col font-sans shadow-2xl">
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}
      {alarmingSchedule && alarmingMedication && <AlarmModal scheduleItem={alarmingSchedule} medication={alarmingMedication} onConfirm={() => { handleToggleTaken(alarmingSchedule.id); setAlarmingScheduleId(null); }} />}
      {viewingSchedule && viewingMedication && <MedicationDetailModal scheduleItem={viewingSchedule} medication={viewingMedication} onClose={() => setViewingScheduleId(null)} onConfirm={() => { handleToggleTaken(viewingSchedule.id); setViewingScheduleId(null); }} />}
      
      <header className="bg-[#5A5A40] text-white p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-3xl font-serif text-center">MemoFarmaci</h1>
        <p className="text-center text-lg opacity-90">{new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <main className="flex-grow p-6 overflow-y-auto">
        {currentView === 'home' && (
          <button 
            onClick={() => setCurrentView('addMedication')} 
            className="w-full flex items-center justify-center gap-2 bg-[#5A5A40] text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:bg-opacity-90 mb-4">
            <Plus size={28} />
            Aggiungi Farmaco
          </button>
      )}
        <div className="space-y-4">
          {todaysEvents.map(item => {
            if (item.type === 'medication' && !item.taken) {
              const now = new Date();
              const [itemHours, itemMinutes] = item.time.split(':').map(Number);
              const itemDate = new Date();
              itemDate.setHours(itemHours, itemMinutes, 0, 0);

              const timeDiffMs = now.getTime() - itemDate.getTime();
              const isPastDue = now >= itemDate;
              const isLate = isPastDue && timeDiffMs > 30 * 60 * 1000;

              let buttonClasses = 'px-6 py-4 rounded-full text-white text-lg font-bold shadow-lg transition-transform transform active:scale-95';
              let buttonDisabled = false;

              if (isLate) {
                buttonClasses += ' bg-red-600 hover:bg-red-700 animate-pulse';
              } else if (isPastDue) {
                buttonClasses += ' bg-green-600 hover:bg-green-700';
              } else {
                buttonClasses += ' bg-gray-400 cursor-not-allowed';
                buttonDisabled = true;
              }

              return (
                <div key={item.id} className={'p-6 rounded-2xl shadow-md flex items-center justify-between transition-all bg-amber-50'}>
                  <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => setViewingScheduleId(item.id)}>
                    {medications.find(m => m.id === item.medicationId)?.boxPhoto && <img src={medications.find(m => m.id === item.medicationId)?.boxPhoto} alt="Scatola" className="w-16 h-16 object-cover rounded-lg shadow-sm" />}
                    <div>
                      <p className="text-2xl font-bold text-slate-800">{item.time}</p>
                      <p className="text-xl text-slate-700">{getMedicationName(item.medicationId)}</p>
                      <p className="text-lg text-slate-500">{item.dosage}</p>
                    </div>
                  </div>
                  <button onClick={() => handleToggleTaken(item.id)} className={buttonClasses} disabled={buttonDisabled}>
                    Conferma
                  </button>
                </div>
              );
            } else if (item.type === 'appointment') {
              return (
                <div key={item.id} className="p-6 rounded-2xl shadow-md flex items-center gap-4 bg-blue-50">
                  <CalendarClock size={40} className="text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{item.time}</p>
                    <p className="text-xl text-slate-700">Appuntamento: Dr. {item.doctor}</p>
                    <p className="text-lg text-slate-500">{item.location}</p>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </main>

      <footer className="bg-white border-t-2 border-gray-100 p-4 flex justify-around items-center rounded-t-3xl shadow-inner-top">
        <button onClick={() => setCurrentView('home')} className="p-4 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#5A5A40]"><Home size={32} /></button>
        <button onClick={() => setCurrentView('appointments')} className="p-4 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#5A5A40]"><CalendarPlus size={32} /></button>
        <button onClick={() => setCurrentView('history')} className="p-4 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#5A5A40]"><CalendarClock size={32} /></button>
        <button onClick={() => setCurrentView('sideEffects')} className="p-4 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#5A5A40]"><FileHeart size={32} /></button>
        <button onClick={() => setCurrentView('planManager')} className="p-4 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#5A5A40]"><Bell size={32} /></button>
      </footer>
    </div>
  );
}
