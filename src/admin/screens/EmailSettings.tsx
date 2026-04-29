import { useEffect, useState } from 'react';
import { MdErrorOutline, MdCheck, MdMail, MdSave, MdDns } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import { AdminCard, AdminInput, AdminPageHeader, AdminToggle } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

export function EmailSettings() {
  const { settings, setSettings } = useAppStore();

  // ── SMTP ──
  const [smtpHost, setSmtpHost] = useState(settings?.smtp_host ?? '');
  const [smtpPort, setSmtpPort] = useState(String(settings?.smtp_port ?? 587));
  const [smtpSecure, setSmtpSecure] = useState(settings?.smtp_secure ?? false);
  const [smtpUser, setSmtpUser] = useState(settings?.smtp_user ?? '');
  const [smtpPassword, setSmtpPassword] = useState(settings?.smtp_password ?? '');
  const [smtpFrom, setSmtpFrom] = useState(settings?.smtp_from ?? '');
  const [smtpFromName, setSmtpFromName] = useState(settings?.smtp_from_name ?? 'PhotoBooth');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [shareInfo, setShareInfo] = useState<{ ip: string; port: number; running: boolean } | null>(null);

  useEffect(() => {
    window.api.share.info().then(setShareInfo).catch(() => {});
  }, []);

  const saveSmtp = async () => {
    await window.api.settings.set('smtp_host', smtpHost);
    await window.api.settings.set('smtp_port', Number(smtpPort) || 587);
    await window.api.settings.set('smtp_secure', smtpSecure);
    await window.api.settings.set('smtp_user', smtpUser);
    await window.api.settings.set('smtp_password', smtpPassword);
    await window.api.settings.set('smtp_from', smtpFrom);
    await window.api.settings.set('smtp_from_name', smtpFromName);
    const fresh = await window.api.settings.get();
    setSettings(fresh);
    setSmtpResult({ ok: true, text: 'Configuration SMTP enregistrée' });
    setTimeout(() => setSmtpResult(null), 3000);
  };

  const testSmtpConn = async () => {
    setSmtpTesting(true);
    setSmtpResult(null);
    const r = await window.api.email.test({
      host: smtpHost,
      port: Number(smtpPort) || 587,
      secure: smtpSecure,
      user: smtpUser,
      password: smtpPassword,
    });
    setSmtpResult(
      r.ok
        ? { ok: true, text: 'Connexion SMTP OK ✓' }
        : { ok: false, text: r.error || 'Erreur de connexion' },
    );
    setSmtpTesting(false);
  };

  return (
    <>
      <AdminPageHeader
        title="Email"
        description="Configuration du serveur SMTP et du serveur de partage local"
      />

      <div className="space-y-4">
        {/* ─── Email SMTP ──────────────────────────────────────────────── */}
        <AdminCard
          title="Email (SMTP)"
          description="Configurez le serveur SMTP pour permettre l'envoi des photos par email"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <AdminInput
                  label="Serveur SMTP"
                  value={smtpHost}
                  onChange={setSmtpHost}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <AdminInput
                label="Port"
                value={smtpPort}
                onChange={setSmtpPort}
                placeholder="587"
              />
            </div>
            <AdminToggle
              label="Connexion sécurisée (SSL/TLS)"
              description="Activez pour le port 465 (SSL). Pour 587 (STARTTLS), laissez désactivé."
              value={smtpSecure}
              onChange={setSmtpSecure}
            />
            <AdminInput
              label="Utilisateur (login SMTP)"
              value={smtpUser}
              onChange={setSmtpUser}
              placeholder="vous@gmail.com"
            />
            <label className="block">
              <span className="block label-editorial mb-2" style={{ color: '#6B5D4F' }}>
                Mot de passe
              </span>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder="Mot de passe d'application"
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
              <span
                className="block mt-2 italic"
                style={{
                  color: '#6B5D4F',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.75rem',
                }}
              >
                Pour Gmail : créez un mot de passe d'application sur myaccount.google.com/apppasswords
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <AdminInput
                label="Adresse expéditeur"
                value={smtpFrom}
                onChange={setSmtpFrom}
                placeholder="contact@mariage.com"
              />
              <AdminInput
                label="Nom expéditeur"
                value={smtpFromName}
                onChange={setSmtpFromName}
                placeholder="Camille & Julien"
              />
            </div>

            {smtpResult && (
              <div
                className="px-4 py-3 flex items-start gap-2"
                style={{
                  backgroundColor: '#F4ECDD',
                  border: `1px solid ${smtpResult.ok ? '#1A1A1A' : '#1A1A1A'}`,
                  borderRadius: '4px',
                  color: '#1A1A1A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                }}
              >
                {smtpResult.ok ? (
                  <MdCheck size={16} className="flex-shrink-0 mt-0.5" />
                ) : (
                  <MdErrorOutline size={16} className="flex-shrink-0 mt-0.5" />
                )}
                <span>{smtpResult.text}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={testSmtpConn}
                icon={<MdDns size={18} />}
                disabled={smtpTesting || !smtpHost}
                fullWidth
              >
                {smtpTesting ? 'Test...' : 'Tester'}
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={saveSmtp}
                icon={<MdSave size={18} />}
                fullWidth
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </AdminCard>

        <AdminCard
          title="Serveur de partage local"
          description="Permet aux invités de scanner le QR code et télécharger leur photo sur le réseau local"
        >
          {shareInfo?.running ? (
            <div
              className="flex items-center gap-3 p-4"
              style={{
                backgroundColor: '#F4ECDD',
                border: '1px solid rgba(212, 184, 150, 0.4)',
                borderRadius: '4px',
              }}
            >
              <div
                className="w-2 h-2 animate-pulse"
                style={{ backgroundColor: '#1A1A1A', borderRadius: '50%' }}
              />
              <div className="flex-1">
                <p
                  style={{
                    color: '#1A1A1A',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                  }}
                >
                  Serveur actif
                </p>
                <p
                  style={{
                    color: '#6B5D4F',
                    fontFamily: 'Inter, monospace',
                    fontSize: '0.875rem',
                  }}
                >
                  http://{shareInfo.ip}:{shareInfo.port}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-3 p-4"
              style={{
                backgroundColor: '#F4ECDD',
                border: '1px solid #1A1A1A',
                borderRadius: '4px',
              }}
            >
              <MdErrorOutline size={18} style={{ color: '#1A1A1A' }} />
              <p
                style={{
                  color: '#1A1A1A',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                }}
              >
                Serveur non démarré
              </p>
            </div>
          )}
          <p
            className="mt-3 italic flex items-center gap-2"
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
            }}
          >
            <MdMail size={12} />
            Les invités doivent être connectés au même Wi-Fi que la borne.
          </p>
        </AdminCard>
      </div>
    </>
  );
}
