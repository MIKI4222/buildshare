import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode, forwardRef, useId } from 'react';

const baseField = 'w-full rounded-lg border border-ink-300 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus-ring hover:border-ink-400';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string }>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">{label}</label>}
        <input ref={ref} id={fieldId} className={`${baseField} h-10 ${error ? 'border-error-400 focus-visible:ring-error-500' : ''} ${className}`} {...props} />
        {error ? <p className="text-xs text-error-600">{error}</p> : hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string }>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">{label}</label>}
        <textarea ref={ref} id={fieldId} className={`${baseField} py-2 min-h-[80px] resize-y ${error ? 'border-error-400' : ''} ${className}`} {...props} />
        {error ? <p className="text-xs text-error-600">{error}</p> : hint ? <p className="text-xs text-ink-400">{hint}</p> : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; children: ReactNode }>(
  ({ label, error, className = '', id, children, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id || autoId;
    return (
      <div className="space-y-1.5">
        {label && <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">{label}</label>}
        <select ref={ref} id={fieldId} className={`${baseField} h-10 ${error ? 'border-error-400' : ''} ${className}`} {...props}>
          {children}
        </select>
        {error && <p className="text-xs text-error-600">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
