import { useState, useEffect, useRef } from 'react';
import type { Medication, TodaysScheduleItem } from '../types';
import { BellRing, Clock } from 'lucide-react';

interface AlarmModalProps {
  scheduleItem: TodaysScheduleItem;
  medication: Medication;
  onConfirm: () => void;
  onSnooze: (minutes: number) => void;
}

export default function AlarmModal({ scheduleItem, medication, onConfirm, onSnooze }: AlarmModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // I bottoni snooze si abilitano solo dopo l'orario pianificato
  const [canSnooze, setCanSnooze] = useState(() => {
    const [h, m] = scheduleItem.time.split(':').map(Number);
    const due = new Date(); due.setHours(h, m, 0, 0);
    return new Date() >= due;
  });

  useEffect(() => {
    if (canSnooze) return;
    const [h, m] = scheduleItem.time.split(':').map(Number);
    const due = new Date(); due.setHours(h, m, 0, 0);
    const msUntilDue = due.getTime() - Date.now();
    if (msUntilDue <= 0) { setCanSnooze(true); return; }
    const timer = setTimeout(() => setCanSnooze(true), msUntilDue);
    return () => clearTimeout(timer);
  }, [scheduleItem.time, canSnooze]);

  useEffect(() => {
    const alarmStartTime = Date.now();
    let soundInterval: ReturnType<typeof setInterval>;

    const playSound = () => {
      audioRef.current?.play().catch(e => console.error("Audio play failed: ", e));
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full text-center max-h-[90vh] overflow-y-auto">
        <BellRing size={40} className="mx-auto text-amber-500 mb-2" />
        <h2 className="text-lg font-bold text-slate-800 mb-1">È ora di prendere:</h2>
        <p className="text-3xl font-bold text-[#0D9488] mb-3">{medication.name}</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <img src={medication.boxPhoto || 'https://picsum.photos/seed/box/400/400'} alt="Scatola" className="w-full h-28 object-contain rounded-lg bg-gray-100 p-2" />
          <img src={medication.pillPhoto || 'https://picsum.photos/seed/pill/400/400'} alt="Pillola" className="w-full h-28 object-contain rounded-lg bg-gray-100 p-2" />
        </div>

        <p className="text-base text-slate-600 mb-4">Dose: <span className="font-bold">{scheduleItem.dosage}</span></p>

        <button
          onClick={onConfirm}
          className="w-full bg-green-600 text-white text-xl font-bold py-4 rounded-2xl shadow-lg hover:bg-green-700 transition-all transform active:scale-95 mb-3"
        >
          Ho preso la medicina
        </button>

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
