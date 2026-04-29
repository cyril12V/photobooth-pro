import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

// Transition ultra courte + cross-fade : pas de translation Y qui crée du vide pendant l'exit.
// Le composant suivant est monté simultanément (mode="popLayout" dans ClientApp).
export function Screen({ children, className = '' }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`absolute inset-0 ${className}`}
    >
      {children}
    </motion.div>
  );
}
