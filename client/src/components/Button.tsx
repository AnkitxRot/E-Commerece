import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-transform duration-snap ease-standard active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none';
const variants = {
  primary: 'bg-accent text-white',
  secondary: 'bg-surface text-ink border border-border',
};

export function Button({ variant = 'primary', loading, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className ?? ''}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? 'Please wait…' : children}
    </button>
  );
}
