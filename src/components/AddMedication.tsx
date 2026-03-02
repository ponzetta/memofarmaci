import { useState } from 'react';
import type React from 'react';
import { Camera, Pill } from 'lucide-react';
import type { Medication } from '../types';
import CropModal from './CropModal';

interface AddMedicationProps {
  onAddMedication: (name: string, boxFile?: File, pillFile?: File) => Promise<void>;
  onClose: () => void;
  existingMedication?: Medication;
}

function resizeImage(file: File, maxSize = 800, quality = 0.8): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        } else {
          if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          resolve(new File([blob!], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AddMedication({ onAddMedication, onClose, existingMedication }: AddMedicationProps) {
  const [name, setName] = useState(existingMedication?.name ?? '');
  const [boxPreview, setBoxPreview] = useState<string | undefined>(existingMedication?.boxPhoto);
  const [pillPreview, setPillPreview] = useState<string | undefined>(existingMedication?.pillPhoto);
  const [boxFile, setBoxFile] = useState<File | undefined>(undefined);
  const [pillFile, setPillFile] = useState<File | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [cropSource, setCropSource] = useState<{
    dataUrl: string;
    setPreview: (v: string) => void;
    setFile: (v: File) => void;
  } | null>(null);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setPreview: (v: string) => void,
    setFile: (v: File) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setCropSource({ dataUrl: reader.result as string, setPreview, setFile });
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!cropSource) return;
    const resized = await resizeImage(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    cropSource.setFile(resized);
    const reader = new FileReader();
    reader.onloadend = () => cropSource.setPreview(reader.result as string);
    reader.readAsDataURL(resized);
    setCropSource(null);
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
    <>
    {cropSource && (
      <CropModal
        imageSrc={cropSource.dataUrl}
        onConfirm={handleCropConfirm}
        onCancel={() => setCropSource(null)}
      />
    )}
    <div className="w-full h-full bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pt-5 pb-4 rounded-b-3xl shadow-lg">
        <h1 className="text-xl font-bold">
          {existingMedication ? 'Modifica Farmaco' : 'Nuovo Farmaco'}
        </h1>
      </header>

      <main className="flex-grow flex flex-col justify-center px-6">
        <div className="mb-6">
          <label htmlFor="medicationName" className="block text-sm font-medium text-slate-600 mb-2">
            Nome del Farmaco
          </label>
          <input
            type="text"
            id="medicationName"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Es. Cardioaspirina"
            className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
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

      <footer className="mt-auto px-6 pb-6">
        <div className="flex gap-4">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-[#0D9488] text-white text-sm font-semibold py-3 rounded-2xl shadow-lg hover:bg-opacity-90 disabled:opacity-60 transition-all transform active:scale-95"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 text-gray-800 text-sm font-semibold py-3 rounded-2xl hover:bg-gray-300 transition-all"
          >
            Annulla
          </button>
        </div>
      </footer>
    </div>
    </>
  );
}
