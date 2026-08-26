import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeCls = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative w-full ${sizeCls[size]} bg-white rounded-2xl shadow-xl border border-ink-200 animate-scale-in max-h-[90vh] flex flex-col`}>
        {(title || description) && (
          <div className="px-6 py-4 border-b border-ink-200 flex items-start justify-between gap-4">
            <div>
              {title && <h2 className="text-lg font-semibold text-ink-900">{title}</h2>}
              {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" className="p-1 h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-ink-200 flex items-center justify-end gap-3 bg-ink-50/50 rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
