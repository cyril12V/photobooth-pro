import { useState } from 'react';
import { MdCheck, MdCloud, MdKey, MdPowerSettingsNew, MdSave } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

type CloudTestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; server: string }
  | { kind: 'error'; message: string };

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

  const [enableQr, setEnableQr] = useState(settings?.enable_qr ?? true);
  const [enableCloud, setEnableCloud] = useState(settings?.enable_cloud ?? false);
  const [cloudVpsUrl, setCloudVpsUrl] = useState(settings?.cloud_vps_url ?? '');
  const [cloudVpsApiKey, setCloudVpsApiKey] = useState(settings?.cloud_vps_api_key ?? '');
  const [cloudTest, setCloudTest] = useState<CloudTestState>({ kind: 'idle' });
  const [saved, setSaved] = useState(false);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const saveToggles = async () => {
    await window.api.settings.set('enable_qr', enableQr);
    await window.api.settings.set('enable_cloud', enableCloud);
    await window.api.settings.set('cloud_vps_url', cloudVpsUrl.trim());
    await window.api.settings.set('cloud_vps_api_key', cloudVpsApiKey.trim());
    const fresh = await window.api.settings.get();
    setSettings(fresh);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const testCloud = async () => {
    setCloudTest({ kind: 'running' });
    try {
      const res = await window.api.cloud.test({
        baseUrl: cloudVpsUrl.trim(),
        apiKey: cloudVpsApiKey.trim(),
      });
      if (res.ok) {
        setCloudTest({ kind: 'ok', server: res.server ?? cloudVpsUrl.trim() });
      } else {
        setCloudTest({ kind: 'error', message: res.error ?? 'Connexion impossible' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setCloudTest({ kind: 'error', message: msg });
    }
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
              label="Cloud / serveur VPS"
              description="Upload photos et vidéos sur ton serveur VPS pour que les invités hors Wi-Fi puissent récupérer leur média (vidéos converties en .mp4 lisibles iPhone/Android)."
              value={enableCloud}
              onChange={setEnableCloud}
            />
          </div>

          {enableCloud && (
            <div className="mt-5 space-y-4 pl-1">
              <label className="block">
                <span className="block label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                  URL du serveur VPS
                </span>
                <input
                  type="url"
                  value={cloudVpsUrl}
                  onChange={(e) => {
                    setCloudVpsUrl(e.target.value);
                    setCloudTest({ kind: 'idle' });
                  }}
                  placeholder="https://lumos-videobooth.fr"
                  className="w-full px-4 py-3 focus:outline-none"
                  style={{
                    backgroundColor: '#F4ECDD',
                    border: '1px solid rgba(212, 184, 150, 0.4)',
                    color: '#1A1A1A',
                    borderRadius: '4px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.9375rem',
                  }}
                />
              </label>

              <label className="block">
                <span className="block label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                  Clé API
                </span>
                <input
                  type="password"
                  value={cloudVpsApiKey}
                  onChange={(e) => {
                    setCloudVpsApiKey(e.target.value);
                    setCloudTest({ kind: 'idle' });
                  }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 focus:outline-none"
                  style={{
                    backgroundColor: '#F4ECDD',
                    border: '1px solid rgba(212, 184, 150, 0.4)',
                    color: '#1A1A1A',
                    borderRadius: '4px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.9375rem',
                    letterSpacing: '0.1em',
                  }}
                />
              </label>

              <Button
                variant="secondary"
                size="md"
                onClick={testCloud}
                icon={<MdCloud size={18} />}
                disabled={
                  cloudTest.kind === 'running' || !cloudVpsUrl.trim() || !cloudVpsApiKey.trim()
                }
                fullWidth
              >
                {cloudTest.kind === 'running' ? 'Test en cours…' : 'Tester la connexion'}
              </Button>

              {cloudTest.kind === 'ok' && (
                <p
                  className="px-3 py-2 text-sm"
                  style={{
                    backgroundColor: '#F4ECDD',
                    border: '1px solid #1A1A1A',
                    borderRadius: '4px',
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Connexion OK ({cloudTest.server})
                </p>
              )}
              {cloudTest.kind === 'error' && (
                <p
                  className="px-3 py-2 text-sm"
                  style={{
                    backgroundColor: '#F4ECDD',
                    border: '1px solid #B5462E',
                    borderRadius: '4px',
                    color: '#B5462E',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Échec : {cloudTest.message}
                </p>
              )}
            </div>
          )}

          <div className="mt-5">
            <Button
              variant="secondary"
              size="md"
              onClick={saveToggles}
              icon={saved ? <MdCheck size={20} /> : <MdSave size={20} />}
              fullWidth
            >
              {saved ? 'Enregistré' : 'Enregistrer les options'}
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
              <span className="block label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Mot de passe actuel
              </span>
              <input
                type="password"
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 focus:outline-none"
                style={{
                  backgroundColor: '#F4ECDD',
                  border: '1px solid rgba(212, 184, 150, 0.4)',
                  color: '#1A1A1A',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  letterSpacing: '0.1em',
                }}
              />
            </label>
            <label className="block">
              <span className="block label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Nouveau mot de passe
              </span>
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 focus:outline-none"
                style={{
                  backgroundColor: '#F4ECDD',
                  border: '1px solid rgba(212, 184, 150, 0.4)',
                  color: '#1A1A1A',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  letterSpacing: '0.1em',
                }}
              />
            </label>
            <label className="block">
              <span className="block label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Confirmer le nouveau mot de passe
              </span>
              <input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 focus:outline-none"
                style={{
                  backgroundColor: '#F4ECDD',
                  border: '1px solid rgba(212, 184, 150, 0.4)',
                  color: '#1A1A1A',
                  borderRadius: '4px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9375rem',
                  letterSpacing: '0.1em',
                }}
              />
            </label>

            {pwMessage && (
              <div
                className="px-4 py-3"
                style={{
                  backgroundColor: '#F4ECDD',
                  border: '1px solid #1A1A1A',
                  borderRadius: '4px',
                  color: '#1A1A1A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                }}
              >
                {pwMessage.text}
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={changePassword}
              icon={<MdKey size={20} />}
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
            icon={<MdPowerSettingsNew size={20} />}
            fullWidth
          >
            Quitter PhotoBooth
          </Button>
          <p
            className="text-center mt-3 italic"
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
            }}
          >
            Astuce : en mode kiosque, vous pouvez aussi appuyer 3 fois sur Ctrl+Shift+Q.
          </p>
        </AdminCard>
      </div>
    </>
  );
}
