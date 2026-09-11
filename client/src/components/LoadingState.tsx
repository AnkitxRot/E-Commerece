export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center py-16 text-sm text-ink-muted">
      {label}
    </div>
  );
}
