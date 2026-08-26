import { type HTMLAttributes, type ReactNode, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  children: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ hover, children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-white border border-ink-200 rounded-xl shadow-card ${hover ? 'transition-all duration-200 hover:shadow-card-hover hover:border-ink-300' : ''} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);
Card.displayName = 'Card';

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 border-b border-ink-200 ${className}`}>{children}</div>;
}

export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-ink-900 ${className}`}>{children}</h3>;
}

export function CardDescription({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-ink-500 mt-1 ${className}`}>{children}</p>;
}
