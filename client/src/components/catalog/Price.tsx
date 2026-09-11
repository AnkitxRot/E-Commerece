import type { Money } from '@audio-commerce/shared';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatMoney(amount: Money): string {
  return inr.format(Number(amount));
}

export function Price({ from, to }: { from: Money; to: Money }) {
  if (from !== to) {
    return (
      <p className="text-ink">
        {formatMoney(from)} – {formatMoney(to)}
      </p>
    );
  }
  return <p className="text-ink">{formatMoney(from)}</p>;
}
