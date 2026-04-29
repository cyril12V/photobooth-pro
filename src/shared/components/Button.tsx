import { motion } from 'framer-motion';
import type { ReactNode, MouseEvent } from 'react';

interface Props {
  children: ReactNode;
  onClick?: (e: MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const variants = {
  primary:
    'text-white shadow-[0_8px_32px_rgba(228,110,90,0.35)] hover:shadow-[0_12px_40px_rgba(228,110,90,0.5)]',
  secondary:
    'bg-white/80 border border-[#d4a574]/40 text-[#5a3e2b] shadow-[0_4px_16px_rgba(90,60,40,0.08)] hover:bg-white/95',
  ghost:
    'bg-white/60 border border-[#d4a574]/30 text-[#5a3e2b] hover:bg-white/80 backdrop-blur',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
};

const sizes = {
  md: 'px-6 py-3 text-base',
  lg: 'px-10 py-5 text-xl',
  xl: 'px-14 py-7 text-2xl',
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  icon,
  disabled,
  fullWidth,
  className = '',
}: Props) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -2 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      disabled={disabled}
      style={
        variant === 'primary'
          ? { background: 'linear-gradient(135deg, #f0a090 0%, #e8806a 50%, #d46855 100%)' }
          : undefined
      }
      className={`btn-touch shine font-medium relative overflow-hidden
        ${variants[variant]} ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
}
