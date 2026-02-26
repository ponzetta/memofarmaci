import { useState } from 'react';
import type React from 'react';
import { Camera, Pill } from 'lucide-react';
import type { Medication } from '../types';

interface AddMedicationProps {
  onAddMedication: (name: string, boxFile?: File, pillFile?: File) => Promise<void>;
  onClose: () => void;
  existingMedication?: Medication;
}

export default function AddMedication({ onAddMedication, onClose, existingMedication }: AddMedicationProps) {
  const [name, setName] = useState(existingMedication?.name ?? '');
  const [boxPreview, setBoxPreview] = useState<string | undefined>(existingMedication?.boxPhoto);
  const [pillPreview, setPillPreview] = useState<string | undefined>(existingMedication?.pillPhoto);
  const [boxFile, setBoxFile] = useState<File | undefined>(undefined);
  const [pillFile, setPillFile] = useState<File | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (v: string) => void,
    setFile: (v: File) => void,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Per favore, inserisci il nome del farmaco.');
      return;
    }
    setSaving(true);
    try {
      await onAddMedication(name.trim(), boxFile, pillFile);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full bg-white p-6 flex flex-col">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-serif text-slate-800">
          {existingMedication ? 'Modifica Farmaco' : 'Nuovo Farmaco'}
        </h2>
        <button onClick={onClose} className="text-2xl font-sans text-gray-500 hover:text-gray-800">&times;</button>
      </header>

      <main className="flex-grow flex flex-col justify-center">
        <div className="mb-6">
          <label htmlFor="medicationName" className="block text-lg font-medium text-slate-600 mb-2">
            Nome del Farmaco
          </label>
          <input
            type="text"
            id="medicationName"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Es. Cardioaspirina"
            className="w-full p-4 border-2 border-gray-200 rounded-xl text-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <label htmlFor="boxPhotoInput" className="cursor-pointer p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-40 hover:bg-gray-50">
            {boxPreview ? (
              <img src={boxPreview} alt="Anteprima scatola" className="w-full h-full object-contain rounded-lg" />
            ) : (
              <>
                <Camera size={40} className="text-slate-500 mb-2" />
                <span className="text-slate-600">Foto Scatola</span>
              </>
            )}
            <input
              type="file" id="boxPhotoInput" accept="image/*" capture="environment"
              className="hidden"
              onChange={e => handleFileChange(e, setBoxPreview, setBoxFile)}
            />
          </label>

          <label htmlFor="pillPhotoInput" className="cursor-pointer p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-40 hover:bg-gray-50">
            {pillPreview ? (
              <img src={pillPreview} alt="Anteprima pillola" className="w-full h-full object-contain rounded-lg" />
            ) : (
              <>
                <Pill size={40} className="text-slate-500 mb-2" />
                <span className="text-slate-600">Foto Farmaco</span>
              </>
            )}
            <input
              type="file" id="pillPhotoInput" accept="image/*" capture="environment"
              className="hidden"
              onChange={e => handleFileChange(e, setPillPreview, setPillFile)}
            />
          </label>
        </div>
      </main>

      <footer className="mt-auto">
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 text-xl font-bold py-5 rounded-2xl hover:bg-gray-300 transition-all"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-[#5A5A40] text-white text-xl font-bold py-5 rounded-2xl shadow-lg hover:bg-opacity-90 disabled:opacity-60 transition-all transform active:scale-95"
          >
            {saving ? 'Salvataggio...' : existingMedication ? 'Salva Modifiche' : 'Salva Farmaco'}
          </button>
        </div>
      </footer>
    </div>
  );
}
