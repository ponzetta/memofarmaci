import { useMemo, useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useMedications } from './hooks/useMedications';
import { useMedicationPlans } from './hooks/useMedicationPlans';
import { useIntakeLogs } from './hooks/useIntakeLogs';
import { useSideEffects } from './hooks/useSideEffects';
import { useAppointments } from './hooks/useAppointments';
import { usePushNotifications } from './hooks/usePushNotifications';
import Toast from './components/Toast';
import OfflineBanner from './components/OfflineBanner';
import type { MedicationPlan, TodaysScheduleItem, Medication } from './types';
import { Bell, Home, FileHeart, CalendarPlus, CalendarClock, Pill, Settings } from 'lucide-react';
import AddMedication from './components/AddMedication';
import ScheduleMedication from './components/ScheduleMedication';
import PlanManager from './components/PlanManager';
import MedicationList from './components/MedicationList';
import AlarmModal from './components/AlarmModal';
import HistoryLog from './components/HistoryLog';
import SideEffects from './components/SideEffects';
import Appointments from './components/Appointments';
import MedicationDetailModal from './components/MedicationDetailModal';
import SettingsPage from './pages/SettingsPage';

type View = 'home' | 'addMedication' | 'addPlan' | 'history' | 'sideEffects' | 'appointments' | 'planManager' | 'medications' | 'settings';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const { medications, addMedication, updateMedication, deleteMedication } = useMedications();
  const { plans, savePlan, deletePlan } = useMedicationPlans();
  const { logs, logIntake, isTakenToday } = useIntakeLogs();
  const { sideEffects, addSideEffect } = useSideEffects();
  const { appointments, addAppointment } = useAppointments();

  const [currentView, setCurrentView] = useState<View>('home');
  const [editingPlan, setEditingPlan] = useState<MedicationPlan | undefined>(undefined);
  const [editingMedication, setEditingMedication] = useState<Medication | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState('');

  const todayStr = getTodayStr();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activePlans = plans.filter(plan => {
    const start = new Date(plan.startDate); start.setHours(0, 0, 0, 0);
    const end = new Date(plan.endDate); end.setHours(0, 0, 0, 0);
    if (today < start || today > end) return false;
    if (plan.frequency === 'daily') return true;
    if (plan.frequency === 'alternate') {
      const diffDays = Math.floor(Math.abs(today.getTime() - start.getTime()) / 86400000);
      return diffDays % 2 === 0;
    }
    return false;
  });

  const todaysSchedule: TodaysScheduleItem[] = activePlans.map(plan => ({
    id: `${plan.id}-${todayStr}`,
    planId: plan.id,
    medicationId: plan.medicationId,
    time: plan.time,
    dosage: plan.dosage,
    taken: isTakenToday(plan.id, plan.time, todayStr),
  }));

  // Ref per il callback di allarme FCM — aggiornato ad ogni render
  const onAlarmRef = useRef<((planId: string) => void) | undefined>(undefined);
  usePushNotifications(undefined, (planId: string) => onAlarmRef.current?.(planId));

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Ref sempre aggiornato per evitare closure stale
  const currentViewRef = useRef<View>('home');
  useEffect(() => { currentViewRef.current = currentView; }, [currentView]);

  // Tasto ← Android + browser: approccio unificato via popstate.
  // Su native: pusho una history entry fittizia → Capacitor vede canGoBack()=true →
  // chiama webView.goBack() (NON lancia backButton event) → popstate si attiva →
  // gestiamo noi il comportamento. Questo impedisce al WebView di tornare
  // all'entry iniziale (stato non autenticato = login screen).
  useEffect(() => {
    history.pushState({ mf: true }, '');
    const onPopState = () => {
      const view = currentViewRef.current;
      if (view !== 'home') {
        setCurrentView('home');
      } else if (Capacitor.isNativePlatform()) {
        setShowExitConfirm(true);
      }
      // Ri-pusho per mantenere sempre canGoBack()=true
      history.pushState({ mf: true }, '');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const [alarmingScheduleId, setAlarmingScheduleId] = useState<string | null>(null);
  const [viewingScheduleId, setViewingScheduleId] = useState<string | null>(null);

  // Snooze: mappa planId → timestamp scadenza snooze, persistita in localStorage
  const [snoozeMap, setSnoozeMap] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('mf_snooze') || '{}'); } catch { return {}; }
  });

  // Aggiorna il callback FCM/nativo con i valori correnti
  onAlarmRef.current = (planId: string) => {
    const item = todaysSchedule.find(s => s.planId === planId && !s.taken);
    if (item && !alarmingScheduleId) setAlarmingScheduleId(item.id);
  };

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const beepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (alarmingScheduleId) {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      // Android richiede resume() esplicito prima di usare AudioContext
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0;
      osc.start();
      oscillatorRef.current = osc;
      gainRef.current = gain;

      const scheduleBeeps = () => {
        const now = ctx.currentTime;
        const g = gain.gain;
        g.cancelScheduledValues(now);
        [0, 0.4, 0.8].forEach(offset => {
          g.setValueAtTime(0.9, now + offset);
          g.setValueAtTime(0, now + offset + 0.25);
        });
      };
      scheduleBeeps();
      beepIntervalRef.current = setInterval(scheduleBeeps, 1600);

      const vibrate = () => { if ('vibrate' in navigator) navigator.vibrate([300, 150, 300, 150, 300]); };
      vibrate();
      vibrateIntervalRef.current = setInterval(vibrate, 1800);
    } else {
      if (beepIntervalRef.current) { clearInterval(beepIntervalRef.current); beepIntervalRef.current = null; }
      if (oscillatorRef.current) { try { oscillatorRef.current.stop(); } catch {} oscillatorRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
      if (vibrateIntervalRef.current) { clearInterval(vibrateIntervalRef.current); vibrateIntervalRef.current = null; }
      if ('vibrate' in navigator) navigator.vibrate(0);
    }
    return () => {
      if (beepIntervalRef.current) clearInterval(beepIntervalRef.current);
      if (vibrateIntervalRef.current) clearInterval(vibrateIntervalRef.current);
    };
  }, [alarmingScheduleId]);

  const todaysEvents = useMemo(() => {
    const medicationEvents = todaysSchedule.map(item => ({ ...item, type: 'medication' as const }));
    const appointmentEvents = appointments
      .filter(app => app.dateTime.startsWith(todayStr))
      .map(app => ({
        ...app,
        type: 'appointment' as const,
        time: app.dateTime.split('T')[1]?.substring(0, 5) ?? '00:00',
      }));
    return [...medicationEvents, ...appointmentEvents].sort((a, b) => a.time.localeCompare(b.time));
  }, [todaysSchedule, appointments, todayStr]);

  useEffect(() => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SET_SCHEDULE', schedule: todaysEvents });
    }
  }, [todaysEvents]);

  // Ascolta messaggi dal Service Worker per triggerare l'allarme quando l'app è in background
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'ALARM_PUSH' && event.data.planId) {
        const item = todaysSchedule.find(s => s.planId === event.data.planId && !s.taken);
        if (item && !alarmingScheduleId) setAlarmingScheduleId(item.id);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [todaysSchedule, alarmingScheduleId]);

  // Legge ?alarm=planId dall'URL quando l'app viene aperta dal Service Worker (app era chiusa)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planId = params.get('alarm');
    if (!planId || todaysSchedule.length === 0) return;
    const item = todaysSchedule.find(s => s.planId === planId && !s.taken);
    if (item && !alarmingScheduleId) {
      setAlarmingScheduleId(item.id);
      window.history.replaceState({}, '', '/');
    }
  // alarmingScheduleId escluso intenzionalmente: il check deve avvenire solo al primo load dei dati
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysSchedule]);

  // Android WebView nativo: tap su notifica FCM → alarm modal
  const [pendingAlarmPlanId, setPendingAlarmPlanId] = useState<string | null>(null);

  useEffect(() => {
    const bridge = (window as unknown as { AndroidBridge?: { getAlarmPlanId?: () => string } }).AndroidBridge;

    // Callback per quando l'app è in background (fired da onNewIntent in MainActivity)
    (window as unknown as { onAlarmFromNotification?: (planId: string) => void }).onAlarmFromNotification =
      (planId: string) => setPendingAlarmPlanId(planId);

    // Pull per quando l'app era chiusa (planId salvato in MainActivity.pendingAlarmPlanId)
    const pulled = bridge?.getAlarmPlanId?.();
    if (pulled) setPendingAlarmPlanId(pulled);

    return () => {
      (window as unknown as { onAlarmFromNotification?: unknown }).onAlarmFromNotification = undefined;
    };
  }, []);

  // Quando todaysSchedule è pronto (o pendingAlarmPlanId cambia), consuma il planId
  useEffect(() => {
    if (!pendingAlarmPlanId || todaysSchedule.length === 0) return;
    const item = todaysSchedule.find(s => s.planId === pendingAlarmPlanId && !s.taken);
    if (item && !alarmingScheduleId) {
      setAlarmingScheduleId(item.id);
      setPendingAlarmPlanId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAlarmPlanId, todaysSchedule]);

  // Deep link nativo Capacitor: tap su notifica FCM → apre alarm modal
  useEffect(() => {
    const listenerPromise = CapApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const planId = new URL(url).searchParams.get('alarm');
        if (!planId || !todaysSchedule.length) return;
        const item = todaysSchedule.find(s => s.planId === planId && !s.taken);
        if (item && !alarmingScheduleId) setAlarmingScheduleId(item.id);
      } catch {}
    });
    return () => { listenerPromise.then(h => h.remove()); };
  }, [todaysSchedule, alarmingScheduleId]);

  // Cerca il primo farmaco scaduto nelle ultime 2 ore, non assunto e non in snooze
  const findOverdueMed = () => {
    if (alarmingScheduleId) return null;
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    return todaysSchedule.find(item => {
      if (item.taken) return false;
      const snoozeUntil = snoozeMap[item.planId];
      if (snoozeUntil && Date.now() < snoozeUntil) return false;
      const [h, m] = item.time.split(':').map(Number);
      const due = new Date(); due.setHours(h, m, 0, 0);
      return due <= now && due > twoHoursAgo;
    }) ?? null;
  };

  // Check immediato all'apertura: scatta appena todaysSchedule si popola
  const initialAlarmCheckedRef = useRef(false);
  useEffect(() => {
    if (initialAlarmCheckedRef.current || todaysSchedule.length === 0) return;
    initialAlarmCheckedRef.current = true;
    const overdue = findOverdueMed();
    if (overdue) setAlarmingScheduleId(overdue.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysSchedule]);

  // Check periodico ogni 10s: finestra 2 ore invece di match esatto al minuto
  useEffect(() => {
    const interval = setInterval(() => {
      const overdue = findOverdueMed();
      if (overdue) {
        const medication = medications.find(m => m.id === overdue.medicationId);
        try {
          if (typeof Notification !== 'undefined') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') {
                new Notification('È ora di prendere la medicina!', {
                  body: `Ricordati di prendere ${medication?.name || 'il farmaco'}`,
                  icon: medication?.pillPhoto || '/vite.svg',
                });
              }
            }).catch(() => {});
          }
        } catch {}
        setAlarmingScheduleId(overdue.id);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [todaysSchedule, alarmingScheduleId, medications]);

  // Handlers
  const handleAddMedication = async (name: string, boxFile?: File, pillFile?: File) => {
    if (editingMedication) {
      await updateMedication(editingMedication.id, name, boxFile, pillFile, !boxFile, !pillFile);
      setEditingMedication(undefined);
    } else {
      await addMedication(name, boxFile, pillFile);
    }
    setCurrentView('medications');
  };

  const handleEditMedication = (med: Medication) => {
    setEditingMedication(med);
    setCurrentView('addMedication');
  };

  const handleSavePlan = async (planData: Omit<MedicationPlan, 'userId' | 'createdAt'>) => {
    await savePlan(planData);
    setEditingPlan(undefined);
    setCurrentView('planManager');
    setToastMessage(planData.id && plans.some(p => p.id === planData.id) ? 'Piano aggiornato!' : 'Piano aggiunto!');
  };

  const handleEditPlan = (plan: MedicationPlan) => {
    setEditingPlan(plan);
    setCurrentView('addPlan');
  };

  const handleToggleTaken = async (scheduleItemId: string) => {
    const item = todaysSchedule.find(i => i.id === scheduleItemId);
    if (item && !item.taken) {
      await logIntake(item.planId, item.medicationId, todayStr, item.time);
      setToastMessage('Assunzione del farmaco registrata, Grazie');
    }
  };

  const handleSnooze = (planId: string, minutes: number) => {
    const snoozeUntil = Date.now() + minutes * 60 * 1000;
    // Salva in localStorage (pulizia entries scadute)
    const now = Date.now();
    const updated: Record<string, number> = {};
    Object.entries(snoozeMap).forEach(([id, until]) => { if (until > now) updated[id] = until; });
    updated[planId] = snoozeUntil;
    setSnoozeMap(updated);
    localStorage.setItem('mf_snooze', JSON.stringify(updated));
    // Android nativo: AlarmManager sveglia l'app allo scadere dello snooze
    const bridge = (window as unknown as { AndroidBridge?: { scheduleSnoozeAlarm?: (planId: string, delayMs: number) => void } }).AndroidBridge;
    bridge?.scheduleSnoozeAlarm?.(planId, minutes * 60 * 1000);
    setAlarmingScheduleId(null);
  };

  const getMedicationName = (id: string) => medications.find(m => m.id === id)?.name || 'Sconosciuto';

  // Router viste
  if (currentView === 'settings') return <SettingsPage onClose={() => setCurrentView('home')} />;
  if (currentView === 'medications') return (
    <MedicationList medications={medications} onAdd={() => { setEditingMedication(undefined); setCurrentView('addMedication'); }} onEdit={handleEditMedication} onDelete={deleteMedication} onClose={() => setCurrentView('home')} />
  );
  if (currentView === 'addMedication') return (
    <AddMedication onAddMedication={handleAddMedication} onClose={() => { setEditingMedication(undefined); setCurrentView('medications'); }} existingMedication={editingMedication} />
  );
  if (currentView === 'addPlan') return (
    <ScheduleMedication medications={medications} onSavePlan={handleSavePlan} onClose={() => { setEditingPlan(undefined); setCurrentView('planManager'); }} existingPlan={editingPlan} />
  );
  if (currentView === 'planManager') return (
    <PlanManager plans={plans} medications={medications} onAddNew={() => { setEditingPlan(undefined); setCurrentView('addPlan'); }} onEdit={handleEditPlan} onDelete={deletePlan} onClose={() => setCurrentView('home')} />
  );
  if (currentView === 'history') return <HistoryLog logs={logs} medications={medications} onClose={() => setCurrentView('home')} />;
  if (currentView === 'sideEffects') return (
    <SideEffects medications={medications} sideEffects={sideEffects} onAddSideEffect={addSideEffect} onClose={() => setCurrentView('home')} />
  );
  if (currentView === 'appointments') return (
    <Appointments appointments={appointments} onAddAppointment={handleAddAppointment} onClose={() => setCurrentView('home')} />
  );

  const alarmingSchedule = todaysSchedule.find(item => item.id === alarmingScheduleId);
  const alarmingMedication = alarmingSchedule ? medications.find(m => m.id === alarmingSchedule.medicationId) : undefined;
  const viewingSchedule = todaysSchedule.find(item => item.id === viewingScheduleId);
  const viewingMedication = viewingSchedule ? medications.find(m => m.id === viewingSchedule.medicationId) : undefined;

  async function handleAddAppointment(doctor: string, location: string, dateTime: string) {
    await addAppointment(doctor, location, dateTime);
    setCurrentView('home');
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        const appointmentTime = new Date(dateTime).getTime();
        const notificationTime = appointmentTime - 60 * 60 * 1000;
        const now = Date.now();
        if (notificationTime > now) {
          setTimeout(() => {
            new Notification('Promemoria Appuntamento', {
              body: `Appuntamento con Dr. ${doctor} tra un'ora presso ${location}.`,
              icon: '/vite.svg',
            });
          }, notificationTime - now);
        }
      }
    });
  }

  return (
    <div className="w-full max-w-md mx-auto h-screen bg-white flex flex-col font-sans shadow-2xl">
      <OfflineBanner />
      {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-slate-800">Sospendi MemoFarmaci?</h2>
            <p className="text-slate-500">L'app rimarrà attiva in background e continuerà a inviarti i promemoria.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="px-5 py-2 rounded-xl text-slate-600 hover:bg-gray-100 font-medium"
              >
                Annulla
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); CapApp.minimizeApp(); }}
                className="px-5 py-2 rounded-xl bg-[#0D9488] text-white font-medium hover:bg-opacity-90"
              >
                Sospendi
              </button>
            </div>
          </div>
        </div>
      )}
      {alarmingSchedule && alarmingMedication && (
        <AlarmModal
          scheduleItem={alarmingSchedule}
          medication={alarmingMedication}
          onConfirm={() => { handleToggleTaken(alarmingSchedule.id); setAlarmingScheduleId(null); }}
          onSnooze={(minutes) => handleSnooze(alarmingSchedule.planId, minutes)}
        />
      )}
      {viewingSchedule && viewingMedication && (
        <MedicationDetailModal
          scheduleItem={viewingSchedule}
          medication={viewingMedication}
          onClose={() => setViewingScheduleId(null)}
          onConfirm={() => { handleToggleTaken(viewingSchedule.id); setViewingScheduleId(null); }}
        />
      )}

      {currentView === 'home' && (
        <header className="bg-[#0D9488] text-white px-6 pb-4 rounded-b-3xl shadow-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
          <h1 className="text-xl font-bold">MemoFarmaci</h1>
          <p className="text-sm opacity-80 mt-0.5 capitalize">
            {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1">
            <span className="text-base font-bold">{todaysSchedule.filter(i => !i.taken).length}</span>
            <span className="text-xs opacity-90">da prendere</span>
          </div>
        </header>
      )}

      <main className="flex-grow p-6 overflow-y-auto">
        {currentView === 'home' && (
          <button
            onClick={() => setCurrentView('planManager')}
            className="w-full flex items-center justify-center gap-2 bg-[#0D9488] text-white text-base font-bold py-3 rounded-2xl shadow-lg hover:bg-opacity-90 mb-4"
          >
            <Bell size={28} />
            Gestione Piani
          </button>
        )}
        <div className="space-y-4">
          {todaysEvents.map(item => {
            if (item.type === 'medication' && !item.taken) {
              const now = new Date();
              const [h, m] = item.time.split(':').map(Number);
              const itemDate = new Date(); itemDate.setHours(h, m, 0, 0);
              const timeDiffMs = now.getTime() - itemDate.getTime();
              const isPastDue = now >= itemDate;
              const isLate = isPastDue && timeDiffMs > 30 * 60 * 1000;

              let btnClass = 'px-5 py-3 rounded-full text-white text-base font-bold shadow-lg transition-transform transform active:scale-95';
              let disabled = false;
              if (isLate) { btnClass += ' bg-red-600 hover:bg-red-700 animate-pulse'; }
              else if (isPastDue) { btnClass += ' bg-green-600 hover:bg-green-700'; }
              else { btnClass += ' bg-gray-400 cursor-not-allowed'; disabled = true; }

              const boxPhoto = medications.find(m => m.id === item.medicationId)?.boxPhoto;
              return (
                <div key={item.id} className="p-6 rounded-2xl shadow-md flex flex-col gap-4 transition-all bg-amber-50">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => setViewingScheduleId(item.id)}>
                    {boxPhoto && <img src={boxPhoto} alt="Scatola" className="w-16 h-16 object-cover rounded-lg shadow-sm" />}
                    <div>
                      <p className="text-lg font-bold text-slate-800">{item.time}</p>
                      <p className="text-base text-slate-700">{getMedicationName(item.medicationId)}</p>
                      <p className="text-sm text-slate-500">{item.dosage}</p>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <button onClick={() => handleToggleTaken(item.id)} className={btnClass} disabled={disabled}>
                      Conferma
                    </button>
                  </div>
                </div>
              );
            } else if (item.type === 'appointment') {
              return (
                <div key={item.id} className="p-6 rounded-2xl shadow-md flex items-center gap-4 bg-blue-50">
                  <CalendarClock size={40} className="text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-slate-800">{item.time}</p>
                    <p className="text-base text-slate-700">Appuntamento: Dr. {item.doctor}</p>
                    <p className="text-sm text-slate-500">{item.location}</p>
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </main>

      <footer className="bg-white border-t-2 border-gray-100 p-4 flex justify-around items-center rounded-t-3xl" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <button onClick={() => setCurrentView('home')} className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#0D9488]"><Home size={28} /></button>
        <button onClick={() => setCurrentView('appointments')} className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#0D9488]"><CalendarPlus size={28} /></button>
        <button onClick={() => setCurrentView('history')} className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#0D9488]"><CalendarClock size={28} /></button>
        <button onClick={() => setCurrentView('sideEffects')} className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#0D9488]"><FileHeart size={28} /></button>
        <button onClick={() => setCurrentView('medications')} className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#0D9488]"><Pill size={28} /></button>
        <button onClick={() => setCurrentView('settings')} className="p-3 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#0D9488]"><Settings size={28} /></button>
      </footer>
    </div>
  );
}
