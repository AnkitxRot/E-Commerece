export function QuantityStepper({
  qty,
  min = 1,
  max,
  onChange,
  label = 'Quantity',
}: {
  qty: number;
  min?: number;
  max: number;
  onChange: (qty: number) => void;
  label?: string;
}) {
  const decDisabled = qty <= min;
  const incDisabled = qty >= max;
  return (
    <div className="inline-flex items-center rounded-md border border-border" role="group" aria-label={label}>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-lg text-ink duration-snap disabled:opacity-40"
        disabled={decDisabled}
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, qty - 1))}
      >
        −
      </button>
      <span className="flex h-11 min-w-[2.5rem] items-center justify-center text-sm font-medium text-ink" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center text-lg text-ink duration-snap disabled:opacity-40"
        disabled={incDisabled}
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(max, qty + 1))}
      >
        +
      </button>
    </div>
  );
}
