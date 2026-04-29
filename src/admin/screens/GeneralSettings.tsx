import { useState } from 'react';
import { Check, KeyRound, Power, Save } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

// Hash SHA-256 client-side (compatible avec celui généré côté Electron)
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function GeneralSettings() {
  const { settings, setSettings } = useAppStore();

  const [enableEmail, setEnableEmail] = useState(settings?.enable_email ?? true);
  const [enableQr, setEnableQr] = useState(settings?.enable_qr ?? true);
  const [enableCloud, setEnableCloud] = useState(settings?.enable_cloud ?? false);
  const [saved, setSaved] = useState(false);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const saveToggles = async () => {
    await window.api.settings.set('enable_email', enableEmail);
    await window.api.settings.set('enable_qr', enableQr);
    await window.api.settings.set('enable_cloud', enableCloud);
    const fresh = await window.api.settings.get();
    setSettings(fresh);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const changePassword = async () => {
    setPwMessage(null);
    if (!oldPw || !newPw || !confirmPw) {
      setPwMessage({ ok: false, text: 'Tous les champs sont obligatoires' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMessage({ ok: false, text: 'Les nouveaux mots de passe ne correspondent pas' });
      return;
    }
    if (newPw.length < 4) {
      setPwMessage({ ok: false, text: 'Le mot de passe doit faire au moins 4 caractères' });
      return;
    }

    const oldHash = await sha256(oldPw);
    if (oldHash !== settings?.admin_password_hash) {
      setPwMessage({ ok: false, text: 'Mot de passe actuel incorrect' });
      return;
    }

    const newHash = await sha256(newPw);
    await window.api.settings.set('admin_password_hash', newHash);
    const fresh = await window.api.settings.get();
    setSettings(fresh);
    setOldPw('');
    setNewPw('');
    setConfirmPw('');
    setPwMessage({ ok: true, text: 'Mot de passe modifié avec succès' });
    setTimeout(() => setPwMessage(null), 3000);
  };

  const quit = () => {
    if (confirm("Quitter l'application PhotoBooth ?")) {
      window.api.app.quit();
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Général"
        description="Sécurité, options de partage et gestion de l'application"
      />

      <div className="space-y-4">
        {/* ─── Options de partage ──────────────────────────────────────── */}
        <AdminCard
          title="Partage"
          description="Activez ou désactivez les méthodes de partage proposées aux invités"
        >
          <div className="divide-y divide-neutral-100">
            <AdminToggle
              label="Impression"
              description="Toujours active"
              value={true}
              onChange={() => {}}
            />
            <AdminToggle
              label="QR Code"
              description="Affiche un QR code pour récupérer la photo sur smartphone"
              value={enableQr}
              onChange={setEnableQr}
            />
            <AdminToggle
              label="Email"
              description="Permet aux invités d'envoyer la photo par email"
              value={enableEmail}
              onChange={setEnableEmail}
            />
            <AdminToggle
              label="Cloud / galerie en ligne"
              description="Synchronise les photos sur Supabase (nécessite internet)"
              value={enableCloud}
              onChange={setEnableCloud}
            />
          </div>

          <div className="mt-5">
            <Button
              variant="secondary"
              size="md"
              onClick={saveToggles}
              icon={saved ? <Check size={20} /> : <Save size={20} />}
              fullWidth
            >
              {saved ? 'Enregistré !' : 'Enregistrer les options'}
            </Button>
          </div>
        </AdminCard>

        {/* ─── Sécurité ────────────────────────────────────────────────── */}
        <AdminCard
          title="Sécurité"
          description="Modifiez le mot de passe de l'espace administrateur"
        >
          <div className="space-y-4">
            <label className="block">
              <span className="block text-neutral-700 text-xs font-medium uppercase tracking-wider mb-1.5">
                Mot de passe actuel
              </span>
              <input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 text-neutral-900 tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-colors"
              />
            </label>
            <label className="block">
              <span className="block text-neutral-700 text-xs font-medium uppercase tracking-wider mb-1.5">
                Nouveau mot de passe
              </span>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 text-neutral-900 tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-colors"
              />
            </label>
            <label className="block">
              <span className="block text-neutral-700 text-xs font-medium uppercase tracking-wider mb-1.5">
                Confirmer le nouveau mot de passe
              </span>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white border border-neutral-300 rounded-lg px-3 py-2.5 text-neutral-900 tracking-widest text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-400 transition-colors"
              />
            </label>

            {pwMessage && (
              <div
                className={`rounded-lg px-4 py-3 text-sm ${
                  pwMessage.ok
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {pwMessage.text}
              </div>
            )}

            <Button
              variant="secondary"
              size="md"
              onClick={changePassword}
              icon={<KeyRound size={20} />}
              fullWidth
            >
              Modifier le mot de passe
            </Button>
          </div>
        </AdminCard>

        {/* ─── Application ─────────────────────────────────────────────── */}
        <AdminCard title="Application" description="Gestion globale">
          <Button
            variant="danger"
            size="md"
            onClick={quit}
            icon={<Power size={20} />}
            fullWidth
          >
            Quitter PhotoBooth
          </Button>
          <p className="text-neutral-400 text-xs text-center mt-3 italic">
            Astuce : en mode kiosque, vous pouvez aussi appuyer 3 fois sur Ctrl+Shift+Q.
          </p>
        </AdminCard>
      </div>
    </>
  );
}
