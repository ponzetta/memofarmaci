import { useRef, useEffect } from 'react';
import type { Medication, TodaysScheduleItem } from '../types';
import { BellRing } from 'lucide-react';

interface AlarmModalProps {
  scheduleItem: TodaysScheduleItem;
  medication: Medication;
  onConfirm: () => void;
}

export default function AlarmModal({ scheduleItem, medication, onConfirm }: AlarmModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

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
      setTimeout(stopSound, 30 * 1000); // Suona per 30 secondi
    };

    soundCycle(); // Avvia subito il primo ciclo
    soundInterval = setInterval(soundCycle, 60 * 1000); // Ripeti ogni 60s (30s on + 30s off)

    // Funzione di pulizia che viene eseguita quando il componente viene smontato
    return () => {
      clearInterval(soundInterval);
      stopSound();
    };
  }, []); // L'array vuoto assicura che l'effetto venga eseguito solo al montaggio e smontaggio

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white rounded-3xl shadow-2xl p-8 m-4 max-w-md w-full text-center animate-pulse-slow">
        <BellRing size={60} className="mx-auto text-amber-500 mb-4" />
        <h2 className="text-4xl font-serif text-slate-800 mb-2">È ora di prendere:</h2>
        <p className="text-5xl font-bold text-[#5A5A40] mb-6">{medication.name}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
            <img src={medication.boxPhoto || 'https://picsum.photos/seed/box/400/400'} alt="Scatola" className="w-full h-40 object-contain rounded-lg bg-gray-100 p-2" />
            <img src={medication.pillPhoto || 'https://picsum.photos/seed/pill/400/400'} alt="Pillola" className="w-full h-40 object-contain rounded-lg bg-gray-100 p-2" />
        </div>

        <p className="text-3xl text-slate-600 mb-8">Dose: <span className="font-bold">{scheduleItem.dosage}</span></p>

        <button 
          onClick={onConfirm}
          className="w-full bg-green-600 text-white text-3xl font-bold py-6 rounded-2xl shadow-lg hover:bg-green-700 transition-all transform active:scale-95"
        >
          Ho preso la medicina
        </button>
      </div>
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg" />
    </div>
  );
}

