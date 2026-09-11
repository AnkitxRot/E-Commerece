import { useToast } from '../context/ToastContext.js';

export function Toast() {
  const { toasts, dismiss } = useToast();
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          onClick={() => dismiss(t.id)}
          className={`rounded-md px-4 py-3 text-sm text-white shadow-md cursor-pointer ${
            t.variant === 'error' ? 'bg-danger' : 'bg-success'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
