import { type ReactNode } from 'react';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'error' | 'info';
type Size = 'sm' | 'md';

const tones: Record<Tone, string> = {
  neutral: 'bg-ink-100 text-ink-700 border-ink-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-accent-50 text-accent-700 border-accent-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  error: 'bg-error-50 text-error-700 border-error-200',
  info: 'bg-info-50 text-info-700 border-info-200',
};

const sizeCls: Record<Size, string> = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-1',
};

interface BadgeProps {
  tone?: Tone;
  size?: Size;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', size = 'md', dot, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${tones[tone]} ${sizeCls[size]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full bg-current`} />}
      {children}
    </span>
  );
}
