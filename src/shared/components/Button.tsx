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

const sizes: Record<NonNullable<Props['size']>, string> = {
  md: 'px-6 py-3 text-sm',
  lg: 'px-10 py-4 text-base',
  xl: 'px-14 py-5 text-lg',
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
  const base: React.CSSProperties = {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    border: 'none',
    borderRadius: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
  };

  const variantStyle: React.CSSProperties = (() => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: '#1A1A1A', color: '#FAF6EE' };
      case 'secondary':
        return { backgroundColor: '#E8DCC4', color: '#1A1A1A' };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#1A1A1A',
          border: '1px solid #1A1A1A',
        };
      case 'danger':
        return { backgroundColor: '#1A1A1A', color: '#FAF6EE' };
      default:
        return {};
    }
  })();

  return (
    <motion.button
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variantStyle, opacity: disabled ? 0.5 : 1 }}
      className={`${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </motion.button>
  );
}
