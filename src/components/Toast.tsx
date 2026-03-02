import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000); // Nascondi dopo 3 secondi

    return () => {
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-green-600 text-white px-8 py-3.5 rounded-2xl shadow-lg z-50 animate-bounce w-max max-w-xs text-center text-sm font-medium">
      {message}
    </div>
  );
}
