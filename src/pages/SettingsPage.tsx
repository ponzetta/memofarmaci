import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';
import TelegramLinkCard from '../components/TelegramLinkCard';
import type { UserProfile } from '../types';

interface SettingsPageProps {
  onClose: () => void;
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { user, signOut } = useAuth();
  const { profile, loading, saveProfile, reload } = useUserProfile();

  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) setForm({ ...profile });
  }, [profile]);

  const set = (field: keyof UserProfile, value: string | number | boolean) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#5A5A40] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-white flex flex-col">
      <header className="bg-[#5A5A40] text-white p-6 rounded-b-3xl shadow-lg flex items-center gap-4">
        <button onClick={onClose} className="text-white text-2xl leading-none">&larr;</button>
        <h1 className="text-3xl font-serif">Impostazioni</h1>
      </header>

      <form onSubmit={handleSave} className="flex-grow p-6 space-y-6 overflow-y-auto">
        {error && <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>}
        {saved && <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm">Salvato!</div>}

        {/* Dati personali */}
        <Section title="Dati personali">
          <Field label="Nome" value={form.firstName ?? ''} onChange={v => set('firstName', v)} />
          <Field label="Cognome" value={form.lastName ?? ''} onChange={v => set('lastName', v)} />
          <Field label="Telefono" value={form.phone ?? ''} onChange={v => set('phone', v)} type="tel" />
          <Field label="Data di nascita" value={form.birthDate ?? ''} onChange={v => set('birthDate', v)} type="date" />
          <Field label="CAP" value={form.postalCode ?? ''} onChange={v => set('postalCode', v)} />
        </Section>

        {/* Caregiver */}
        <Section title="Caregiver">
          <Field label="Nome caregiver" value={form.caregiverName ?? ''} onChange={v => set('caregiverName', v)} />
          <Field label="Telefono caregiver" value={form.caregiverPhone ?? ''} onChange={v => set('caregiverPhone', v)} type="tel" />
          <Field label="Email caregiver" value={form.caregiverEmail ?? ''} onChange={v => set('caregiverEmail', v)} type="email" />
        </Section>

        {/* Alert mancata assunzione */}
        <Section title="Avvisi mancata assunzione">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Avvisa dopo (ore)</label>
            <select
              value={form.missedDoseAlertHours ?? 2}
              onChange={e => set('missedDoseAlertHours', parseInt(e.target.value))}
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
            >
              {[1, 2, 3, 4, 6].map(h => (
                <option key={h} value={h}>{h} {h === 1 ? 'ora' : 'ore'}</option>
              ))}
            </select>
          </div>

          <Toggle
            label="Alert email al caregiver"
            value={form.alertEmailEnabled ?? false}
            onChange={v => set('alertEmailEnabled', v)}
          />
          <Toggle
            label="Alert Telegram a me"
            value={form.alertTelegramUserEnabled ?? false}
            onChange={v => set('alertTelegramUserEnabled', v)}
          />
          <Toggle
            label="Alert Telegram al caregiver"
            value={form.alertTelegramCaregiverEnabled ?? false}
            onChange={v => set('alertTelegramCaregiverEnabled', v)}
          />
        </Section>

        {/* Collegamento Telegram */}
        <Section title="Collegamento Telegram">
          <TelegramLinkCard
            type="user"
            label="Il mio Telegram"
            alreadyLinked={!!profile?.telegramUserChatId}
            onLinked={() => reload()}
          />
          <TelegramLinkCard
            type="caregiver"
            label="Telegram caregiver"
            alreadyLinked={!!profile?.telegramCaregiverChatId}
            onLinked={() => reload()}
          />
        </Section>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#5A5A40] text-white text-xl font-bold py-5 rounded-2xl shadow-lg hover:bg-opacity-90 disabled:opacity-60 transition-all"
        >
          {saving ? 'Salvataggio...' : 'Salva modifiche'}
        </button>

        {/* Account */}
        <Section title="Account">
          <div className="text-sm text-slate-500 text-center">{user?.email}</div>
          <button
            type="button"
            onClick={signOut}
            className="w-full bg-red-50 text-red-600 border border-red-200 text-lg font-medium py-4 rounded-2xl hover:bg-red-100 transition-all"
          >
            Esci dall'account
          </button>
        </Section>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[#5A5A40] mb-3 uppercase tracking-wide">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text'
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full p-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#5A5A40]"
      />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-[#5A5A40]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
