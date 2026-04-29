import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  accentBar?: boolean;
}

export function AdminCard({ title, description, children, className = '', accentBar = false }: CardProps) {
  return (
    <div className={`bg-white border border-neutral-200 rounded-2xl p-8 shadow-md ${className}`}>
      {title && (
        <div className="mb-6">
          <div className="flex items-center gap-3">
            {accentBar && (
              <div
                className="w-1 h-5 rounded-full flex-shrink-0"
                style={{ background: 'linear-gradient(to bottom, #e8c79a, #d4a574)' }}
              />
            )}
            <h3 className="font-semibold text-neutral-900 text-base">{title}</h3>
          </div>
          {description && (
            <p className="text-neutral-500 text-sm mt-1.5 ml-0">{description}</p>
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
    <div className="mb-8">
      {subtitle && (
        <p
          className="text-xs font-semibold uppercase tracking-[0.35em] mb-1"
          style={{ color: '#c8956a' }}
        >
          {subtitle}
        </p>
      )}
      <h1 className="font-bold text-3xl text-neutral-900 leading-tight">{title}</h1>
      {description && <p className="text-neutral-500 text-sm mt-1.5">{description}</p>}
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
      <span className="block text-neutral-600 text-xs font-semibold uppercase tracking-wider mb-1.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-neutral-200 rounded-lg px-3.5 py-2.5 text-neutral-900 placeholder:text-neutral-400 text-sm transition-all duration-150 focus:outline-none"
        style={{
          boxShadow: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = '#d4a574';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(212,165,116,0.15)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = '';
          e.currentTarget.style.boxShadow = 'none';
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
        <p className="text-neutral-900 font-medium text-sm">{label}</p>
        {description && <p className="text-neutral-500 text-xs mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1"
        style={{
          background: value
            ? 'linear-gradient(135deg, #e8c79a 0%, #d4a574 100%)'
            : '#e5e7eb',
          boxShadow: value ? '0 2px 8px rgba(212,165,116,0.4)' : 'none',
        }}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
            ${value ? 'translate-x-5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  );
}
