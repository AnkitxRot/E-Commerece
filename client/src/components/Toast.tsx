import { useToast } from '../context/ToastContext.js';

export function Toast() {
  const { toasts, dismiss } = useToast();
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          tabIndex={0}
          onClick={() => dismiss(t.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dismiss(t.id);
            }
          }}
          aria-label={`${t.message} — dismiss`}
          className={`cursor-pointer rounded-md px-4 py-3 text-sm text-white shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
            t.variant === 'error' ? 'bg-danger' : 'bg-success'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
