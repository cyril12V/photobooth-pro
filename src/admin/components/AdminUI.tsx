import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  accentBar?: boolean;
}

export function AdminCard({
  title,
  description,
  children,
  className = '',
  accentBar = false,
}: CardProps) {
  return (
    <div
      className={`p-8 ${className}`}
      style={{
        backgroundColor: '#FAF6EE',
        border: '1px solid rgba(212, 184, 150, 0.2)',
        borderRadius: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}
    >
      {title && (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {accentBar && (
              <div
                className="w-1 h-5 flex-shrink-0"
                style={{ backgroundColor: '#1A1A1A' }}
              />
            )}
            <h3
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                color: '#1A1A1A',
                fontSize: '1.125rem',
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </h3>
          </div>
          {description && (
            <p
              className="mt-2"
              style={{
                color: '#6B5D4F',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export function AdminPageHeader({
  title,
  description,
  subtitle,
}: {
  title: string;
  description?: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 pb-6" style={{ borderBottom: '1px solid #1A1A1A' }}>
      {subtitle && (
        <p
          className="label-editorial mb-2"
          style={{ color: '#6B5D4F' }}
        >
          {subtitle}
        </p>
      )}
      <h1
        style={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 800,
          color: '#1A1A1A',
          fontSize: '2.5rem',
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
        }}
      >
        {title}
      </h1>
      {description && (
        <p
          className="mt-2"
          style={{
            color: '#6B5D4F',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function AdminInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span
        className="block label-editorial mb-2"
        style={{ color: '#6B5D4F' }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 transition-all duration-150 focus:outline-none"
        style={{
          backgroundColor: '#F4ECDD',
          border: '1px solid rgba(212, 184, 150, 0.4)',
          color: '#1A1A1A',
          borderRadius: '4px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.9375rem',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#1A1A1A';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(212, 184, 150, 0.4)';
        }}
      />
    </label>
  );
}

export function AdminToggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p
          style={{
            color: '#1A1A1A',
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}
        >
          {label}
        </p>
        {description && (
          <p
            className="mt-0.5"
            style={{
              color: '#6B5D4F',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.75rem',
            }}
          >
            {description}
          </p>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 transition-all duration-200 flex-shrink-0 focus:outline-none"
        style={{
          backgroundColor: value ? '#1A1A1A' : '#E8DCC4',
          borderRadius: '999px',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-pressed={value}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 transition-transform duration-200"
          style={{
            backgroundColor: '#FAF6EE',
            borderRadius: '999px',
            transform: value ? 'translateX(20px)' : 'translateX(0)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        />
      </button>
    </div>
  );
}
