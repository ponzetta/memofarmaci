import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface TelegramLinkCardProps {
  type: 'user' | 'caregiver';
  label: string;
  alreadyLinked: boolean;
  onLinked: () => void;
}

export default function TelegramLinkCard({ type, label, alreadyLinked, onLinked }: TelegramLinkCardProps) {
  const [token, setToken] = useState<string | null>(null);
  const [botName, setBotName] = useState('MemoFarmaciBot');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => stopPolling(), []);

  const generateToken = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione non valida');

      const res = await fetch('/api/auth/telegram-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ type }),
      });
      const data = await res.json() as { token?: string; botName?: string; expiresAt?: string; error?: string };
      if (!res.ok || !data.token) throw new Error(data.error ?? 'Errore generazione token');

      setToken(data.token);
      setBotName(data.botName ?? 'MemoFarmaciBot');
      setExpiresAt(data.expiresAt ?? null);

      // Polling ogni 5s per verificare collegamento
      stopPolling();
      pollRef.current = setInterval(async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (!s) return;
        const r = await fetch(`/api/auth/telegram-link-status?type=${type}`, {
          headers: { 'Authorization': `Bearer ${s.access_token}` },
        });
        const d = await r.json() as { linked?: boolean };
        if (d.linked) {
          stopPolling();
          setToken(null);
          onLinked();
        }
      }, 5000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (alreadyLinked) {
    return (
      <div className="p-4 bg-green-50 rounded-xl border border-green-200">
        <p className="text-green-700 font-medium">✅ {label} collegato</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
      <p className="font-medium text-slate-700">{label}</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {token ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            Scrivi al bot <strong>@{botName}</strong> il codice:
          </p>
          <div className="bg-white border-2 border-[#5A5A40] rounded-xl p-4 text-center">
            <span className="text-3xl font-mono font-bold text-[#5A5A40] tracking-widest">{token}</span>
          </div>
          <p className="text-xs text-slate-400 text-center">
            Scade alle {expiresAt ? new Date(expiresAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
          <p className="text-xs text-slate-500 text-center animate-pulse">In attesa di collegamento...</p>
        </div>
      ) : (
        <button
          onClick={generateToken}
          disabled={loading}
          className="w-full bg-[#5A5A40] text-white py-3 rounded-xl font-medium disabled:opacity-60"
        >
          {loading ? 'Generazione...' : 'Genera codice'}
        </button>
      )}
    </div>
  );
}
