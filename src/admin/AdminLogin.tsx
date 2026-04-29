import { useState } from 'react';
import { motion } from 'framer-motion';
import { MdLock, MdErrorOutline } from 'react-icons/md';
import { useAppStore } from '@shared/store';

// Hash SHA-256 client-side
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
});

export function AdminLogin() {
  const { settings, setAdminAuthenticated, setAdminMode } = useAppStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const submit = async () => {
    const hash = await sha256(password);
    if (hash === settings?.admin_password_hash) {
      setAdminAuthenticated(true);
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: '#F4ECDD' }}
    >
      {/* Header éditorial fin */}
      <div
        className="absolute top-0 left-0 right-0 px-12 py-6 flex items-center justify-between z-10"
        style={{ borderBottom: '1px solid #1A1A1A' }}
      >
        <span className="label-editorial" style={{ color: '#1A1A1A' }}>
          Admin
        </span>
        <span className="label-editorial" style={{ color: '#1A1A1A' }}>
          Photobooth Pro
        </span>
        <span className="label-editorial" style={{ color: '#1A1A1A' }}>
          № 000
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{
          opacity: 1,
          y: 0,
          x: shaking ? [0, -10, 10, -10, 10, 0] : 0,
        }}
        transition={{ duration: shaking ? 0.5 : 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="card-editorial relative z-10 max-w-md w-full mx-6 p-12"
      >
        <motion.div {...fadeUp(0.1)} className="flex justify-center mb-6">
          <div
            className="w-16 h-16 flex items-center justify-center"
            style={{ backgroundColor: '#1A1A1A', borderRadius: '4px' }}
          >
            <MdLock size={28} color="#FAF6EE" />
          </div>
        </motion.div>

        <motion.p
          {...fadeUp(0.2)}
          className="label-editorial text-center mb-3"
          style={{ color: '#6B5D4F' }}
        >
          Espace privé
        </motion.p>

        <motion.h1
          {...fadeUp(0.3)}
          className="font-editorial text-center mb-8"
          style={{
            fontSize: '2.25rem',
            color: '#1A1A1A',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          MODE ADMIN
        </motion.h1>

        <motion.div {...fadeUp(0.4)}>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="••••••••"
            className="w-full px-4 py-3 text-center focus:outline-none mb-3"
            style={{
              backgroundColor: '#F4ECDD',
              border: error ? '1px solid #1A1A1A' : '1px solid rgba(212, 184, 150, 0.4)',
              color: '#1A1A1A',
              borderRadius: '4px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '1rem',
              letterSpacing: '0.3em',
            }}
            autoFocus
          />
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center gap-2 mb-3"
          >
            <MdErrorOutline size={15} style={{ color: '#1A1A1A' }} />
            <span
              className="label-editorial"
              style={{ color: '#1A1A1A', fontSize: '0.6875rem' }}
            >
              Mot de passe incorrect
            </span>
          </motion.div>
        )}

        <motion.div {...fadeUp(0.5)}>
          <button onClick={submit} className="btn-editorial-primary w-full">
            Se connecter
          </button>
        </motion.div>

        <motion.div {...fadeUp(0.6)} className="text-center mt-5">
          <button
            onClick={() => setAdminMode(false)}
            className="btn-editorial-ghost"
          >
            Retour à l'application
          </button>
        </motion.div>

        <motion.p
          {...fadeUp(0.7)}
          className="text-xs text-center mt-8"
          style={{
            color: '#6B5D4F',
            opacity: 0.6,
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'italic',
          }}
        >
          Mot de passe par défaut :{' '}
          <code style={{ color: '#1A1A1A', fontFamily: 'monospace' }}>admin</code>
        </motion.p>
      </motion.div>
    </div>
  );
}
