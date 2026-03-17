import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../hooks/useUserProfile';

export default function CompleteProfilePage() {
  const { user, setProfileCompleted } = useAuth();
  const { saveProfile } = useUserProfile();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    birthDate: '',
    postalCode: '',
    caregiverName: '',
    caregiverPhone: '',
    caregiverEmail: '',
    missedDoseAlertHours: 2,
  });
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentHealth, setConsentHealth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Nome e cognome sono obbligatori');
      return;
    }
    if (!consentPrivacy || !consentHealth) {
      setError('Devi accettare la Privacy Policy e il consenso al trattamento dei dati sanitari per continuare');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await saveProfile({
        ...form,
        email: user?.email,
        alertEmailEnabled: false,
        alertTelegramUserEnabled: false,
        alertTelegramCaregiverEnabled: false,
        profileCompleted: true,
        privacyPolicyAcceptedAt: now,
        healthDataConsentAt: now,
        privacyPolicyVersion: '1.0',
      });
      setProfileCompleted(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-white flex flex-col">
      <header className="bg-[#0D9488] text-white px-6 pb-6 rounded-b-3xl shadow-lg" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)' }}>
        <h1 className="text-3xl font-serif text-center">Completa il profilo</h1>
        <p className="text-center text-sm opacity-80 mt-1">Necessario per usare l'app</p>
      </header>

      <form onSubmit={handleSubmit} className="flex-grow p-6 space-y-5 overflow-y-auto">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">{error}</div>
        )}

        <Section title="Dati personali">
          <Field label="Nome *" value={form.firstName} onChange={v => set('firstName', v)} placeholder="Mario" />
          <Field label="Cognome *" value={form.lastName} onChange={v => set('lastName', v)} placeholder="Rossi" />
          <Field label="Telefono" value={form.phone} onChange={v => set('phone', v)} placeholder="+39 333 1234567" type="tel" />
          <Field label="Data di nascita" value={form.birthDate} onChange={v => set('birthDate', v)} type="date" />
          <Field label="CAP" value={form.postalCode} onChange={v => set('postalCode', v)} placeholder="20100" />
        </Section>

        <Section title="Caregiver (opzionale)">
          <Field label="Nome caregiver" value={form.caregiverName} onChange={v => set('caregiverName', v)} placeholder="Anna Rossi" />
          <Field label="Telefono caregiver" value={form.caregiverPhone} onChange={v => set('caregiverPhone', v)} type="tel" />
          <Field label="Email caregiver" value={form.caregiverEmail} onChange={v => set('caregiverEmail', v)} type="email" />
        </Section>

        <Section title="Avvisi mancata assunzione">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Avvisa dopo (ore)
            </label>
            <select
              value={form.missedDoseAlertHours}
              onChange={e => set('missedDoseAlertHours', parseInt(e.target.value))}
              className="w-full p-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
            >
              {[1, 2, 3, 4, 6].map(h => (
                <option key={h} value={h}>{h} {h === 1 ? 'ora' : 'ore'}</option>
              ))}
            </select>
          </div>
        </Section>

        {/* Consensi GDPR obbligatori */}
        <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-4">
          <h3 className="text-base font-semibold text-slate-700">Privacy e consensi (obbligatori)</h3>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentPrivacy}
              onChange={e => setConsentPrivacy(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0D9488] flex-shrink-0"
            />
            <span className="text-sm text-slate-600">
              Ho letto e accetto la{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0D9488] font-semibold underline"
              >
                Privacy Policy
              </a>
              , incluso il trattamento dei miei dati personali per l'erogazione del servizio.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentHealth}
              onChange={e => setConsentHealth(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0D9488] flex-shrink-0"
            />
            <span className="text-sm text-slate-600">
              Acconsento esplicitamente al trattamento dei miei{' '}
              <strong>dati sanitari</strong> (farmaci, dosaggi, log assunzione, effetti
              collaterali) ai sensi dell'art. 9 §2a del Regolamento UE 2016/679 (GDPR).
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving || !consentPrivacy || !consentHealth}
          className="w-full bg-[#0D9488] text-white text-xl font-bold py-5 rounded-2xl shadow-lg hover:bg-opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Salvataggio...' : 'Salva e inizia'}
        </button>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-[#0D9488] mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text'
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
      />
    </div>
  );
}
