import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldAlert } from 'lucide-react';
import { useAppStore } from '@shared/store';
import { CornerDecor } from '@client/components/decors';

// Hash SHA-256 client-side (compatible avec celui généré côté Electron)
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
});

export function AdminLogin() {
  const { settings, setAdminAuthenticated, setAdminMode } = useAppStore();
  const decorStyle = settings?.decor_style ?? 'floral';
  const customImagePath = settings?.decor_custom_path ?? null;
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
      style={{
        background:
          'radial-gradient(ellipse 80% 60% at 20% 0%, rgba(245,224,205,0.7) 0%, transparent 65%),' +
          'radial-gradient(ellipse 70% 50% at 80% 100%, rgba(242,196,206,0.4) 0%, transparent 60%),' +
          'radial-gradient(ellipse 50% 50% at 50% 50%, rgba(250,240,220,0.5) 0%, transparent 70%),' +
          '#faf6ef',
      }}
    >
      {/* Coins décoratifs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 1 }}
        className="absolute top-0 left-0 w-48 h-48 pointer-events-none"
      >
        <CornerDecor style={decorStyle} position="tl" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none"
      >
        <CornerDecor style={decorStyle} position="br" className="w-full h-full" customImagePath={customImagePath} />
      </motion.div>

      {/* Carte centrale */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{
          opacity: 1,
          y: 0,
          x: shaking ? [0, -10, 10, -10, 10, 0] : 0,
        }}
        transition={{ duration: shaking ? 0.5 : 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-md w-full mx-6 px-10 py-12 rounded-3xl"
        style={{
          background: 'rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(212,165,116,0.30)',
          boxShadow: '0 24px 64px rgba(90,60,40,0.12)',
        }}
      >
        {/* Icône cadenas */}
        <motion.div {...fadeUp(0.1)} className="flex justify-center mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #e8c79a 0%, #d4a574 100%)',
              boxShadow: '0 8px 24px rgba(212,165,116,0.35)',
            }}
          >
            <Lock size={34} color="#2a1a10" strokeWidth={2} />
          </div>
        </motion.div>

        {/* Surtitle */}
        <motion.p
          {...fadeUp(0.2)}
          className="text-center text-xs font-semibold uppercase tracking-[0.4em] mb-2"
          style={{ color: '#c8956a' }}
        >
          Espace privé
        </motion.p>

        {/* Titre Allura */}
        <motion.h1
          {...fadeUp(0.3)}
          className="text-center mb-6"
          style={{
            fontFamily: '"Allura", cursive',
            fontSize: '2.6rem',
            color: '#2a1a10',
            lineHeight: 1.2,
          }}
        >
          Mode administrateur
        </motion.h1>

        {/* Input mot de passe */}
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
            className="w-full rounded-xl px-5 py-4 text-lg text-center tracking-widest focus:outline-none transition-colors mb-3"
            style={{
              background: 'rgba(255,255,255,0.60)',
              border: error
                ? '1.5px solid #ef4444'
                : '1.5px solid rgba(212,165,116,0.30)',
              color: '#2a1a10',
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.border = '1.5px solid #d4a574';
              }
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.border = '1.5px solid rgba(212,165,116,0.30)';
              }
            }}
            autoFocus
          />
        </motion.div>

        {/* Message d'erreur */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-red-500 text-sm mb-3"
          >
            <ShieldAlert size={15} />
            Mot de passe incorrect
          </motion.div>
        )}

        {/* Bouton Se connecter */}
        <motion.div {...fadeUp(0.5)}>
          <motion.button
            onClick={submit}
            className="w-full py-4 rounded-full text-white font-semibold text-base uppercase tracking-[0.15em] transition-all"
            style={{
              background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)',
              boxShadow: '0 8px 28px rgba(228,110,90,0.35)',
            }}
            whileHover={{ scale: 1.02, boxShadow: '0 12px 36px rgba(228,110,90,0.5)' }}
            whileTap={{ scale: 0.97 }}
          >
            Se connecter
          </motion.button>
        </motion.div>

        {/* Retour */}
        <motion.div {...fadeUp(0.6)} className="text-center mt-5">
          <button
            onClick={() => setAdminMode(false)}
            className="text-sm transition-colors"
            style={{ color: 'rgba(90,62,43,0.45)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(90,62,43,0.85)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(90,62,43,0.45)'; }}
          >
            Retour à l'application
          </button>
        </motion.div>

        {/* Note pied de carte */}
        <motion.p
          {...fadeUp(0.7)}
          className="text-xs text-center italic mt-8"
          style={{ color: 'rgba(90,62,43,0.35)' }}
        >
          Mot de passe par défaut :{' '}
          <code style={{ color: 'rgba(212,165,116,0.8)' }}>admin</code>
        </motion.p>
      </motion.div>
    </div>
  );
}
