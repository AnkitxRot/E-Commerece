export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`animate-pulse rounded-sm bg-surface ${className}`} aria-hidden="true" />;
}
