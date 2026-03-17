import { useState, useEffect, useRef } from 'react';
import type { Medication, TodaysScheduleItem } from '../types';
import { BellRing, Clock, CheckCircle2 } from 'lucide-react';

interface AlarmModalProps {
  scheduleItems: TodaysScheduleItem[];
  medications: Medication[];
  onConfirmOne: (scheduleItemId: string) => void;
  onConfirmAll: () => void;
  onSnooze: (minutes: number) => void;
}

export default function AlarmModal({ scheduleItems, medications, onConfirmOne, onConfirmAll, onSnooze }: AlarmModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const time = scheduleItems[0]?.time ?? '';

  // I bottoni snooze si abilitano solo dopo l'orario pianificato
  const getSnoozeDelay = () => {
    const [h, m] = time.split(':').map(Number);
    const due = new Date(); due.setHours(h, m, 0, 0);
    return Math.max(0, due.getTime() - Date.now());
  };
  const [canSnooze, setCanSnooze] = useState(() => getSnoozeDelay() === 0);

  useEffect(() => {
    if (canSnooze) return;
    const delay = getSnoozeDelay();
    if (delay === 0) { setCanSnooze(true); return; }
    const timer = setTimeout(() => setCanSnooze(true), delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Audio (solo su browser/iOS; su Android il suono nativo è già in riproduzione)
  useEffect(() => {
    if ((window as any).AndroidBridge) return;

    const alarmStartTime = Date.now();
    let soundInterval: ReturnType<typeof setInterval>;

    const playSound = () => {
      audioRef.current?.play().catch(e => console.error('Audio play failed: ', e));
    };
    const stopSound = () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
    const soundCycle = () => {
      if (Date.now() - alarmStartTime > 30 * 60 * 1000) {
        clearInterval(soundInterval);
        stopSound();
        return;
      }
      playSound();
      setTimeout(stopSound, 30 * 1000);
    };

    soundCycle();
    soundInterval = setInterval(soundCycle, 60 * 1000);
    return () => {
      clearInterval(soundInterval);
      stopSound();
    };
  }, []);

  const handleConfirm = (item: TodaysScheduleItem) => {
    if (confirmedIds.has(item.id)) return;
    const newConfirmed = new Set([...confirmedIds, item.id]);
    setConfirmedIds(newConfirmed);
    onConfirmOne(item.id);
    if (newConfirmed.size === scheduleItems.length) {
      // Breve ritardo per mostrare l'ultimo bottone come "Preso" prima della chiusura
      setTimeout(() => onConfirmAll(), 400);
    }
  };

  const isSingle = scheduleItems.length === 1;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full text-center max-h-[90vh] overflow-y-auto">
        <BellRing size={40} className="mx-auto text-amber-500 mb-2" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">
          {isSingle ? 'È ora di prendere:' : `${scheduleItems.length} farmaci da prendere`}
        </h2>
        <p className="text-base font-semibold text-slate-500 mb-4">Orario: {time}</p>

        <div className="space-y-4 mb-4">
          {scheduleItems.map(item => {
            const med = medications.find(m => m.id === item.medicationId);
            const confirmed = confirmedIds.has(item.id);
            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border-2 transition-all ${
                  confirmed ? 'border-green-300 bg-green-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                {isSingle ? (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <img
                      src={med?.boxPhoto || 'https://picsum.photos/seed/box/400/400'}
                      alt="Scatola"
                      className="w-full h-28 object-contain rounded-lg bg-gray-100 p-2"
                    />
                    <img
                      src={med?.pillPhoto || 'https://picsum.photos/seed/pill/400/400'}
                      alt="Pillola"
                      className="w-full h-28 object-contain rounded-lg bg-gray-100 p-2"
                    />
                  </div>
                ) : (
                  med?.boxPhoto && (
                    <img
                      src={med.boxPhoto}
                      alt="Scatola"
                      className="w-16 h-16 object-contain rounded-lg bg-gray-100 p-2 mx-auto mb-2"
                    />
                  )
                )}
                <p className="text-xl font-bold text-[#0D9488] mb-1">{med?.name ?? 'Farmaco'}</p>
                <p className="text-sm text-slate-500 mb-3">
                  Dose: <span className="font-bold">{item.dosage}</span>
                </p>
                <button
                  onClick={() => handleConfirm(item)}
                  disabled={confirmed}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all transform ${
                    confirmed
                      ? 'bg-green-400 cursor-default'
                      : 'bg-green-600 hover:bg-green-700 active:scale-95'
                  }`}
                >
                  {confirmed ? (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle2 size={18} /> Preso
                    </span>
                  ) : 'Ho preso'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottoni snooze: abilitati solo dopo l'orario pianificato */}
        <div className="flex gap-2">
          {[5, 15, 30].map(min => (
            <button
              key={min}
              onClick={() => onSnooze(min)}
              disabled={!canSnooze}
              className={`flex-1 flex items-center justify-center gap-1 py-3 rounded-xl text-sm font-medium transition-all
                ${canSnooze
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 active:scale-95'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
            >
              <Clock size={14} />
              +{min} min
            </button>
          ))}
        </div>
      </div>
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg" />
    </div>
  );
}
