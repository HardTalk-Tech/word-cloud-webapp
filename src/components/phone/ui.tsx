// Shared phone UI bits: brand header, buttons, step shell.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { BRAND } from '@/config/brand';

/** George Steuart logo (crown + wordmark, dark-background version). */
export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-36' : size === 'md' ? 'h-24' : 'h-16';
  return (
    <div className="flex justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BRAND.logo} alt={BRAND.name} className={`${h} w-auto`} />
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' };

export function Button({ variant = 'primary', className = '', children, ...rest }: ButtonProps) {
  const base =
    'inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-6 text-lg font-bold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100';
  const styles = {
    primary: 'bg-brand text-white shadow-[0_10px_30px_-10px_rgba(172,31,45,0.8)]',
    secondary: 'bg-surface-raised text-white ring-1 ring-line',
    ghost: 'bg-transparent text-brand-grey-light',
  }[variant];
  return (
    <button className={`${base} ${styles} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function StepShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-6 pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <div className="flex flex-1 flex-col">{children}</div>
      {footer && <div className="mt-6 flex flex-col gap-3">{footer}</div>}
    </div>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mt-2 text-center">
      <h1 className="text-[1.75rem] leading-tight font-extrabold">{children}</h1>
      {sub && <p className="mt-2 text-base text-brand-grey-light">{sub}</p>}
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
