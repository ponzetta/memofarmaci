import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="w-full bg-yellow-500 text-white text-center py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium z-50">
      <WifiOff size={16} />
      Sei offline — le modifiche non vengono salvate
    </div>
  );
}
