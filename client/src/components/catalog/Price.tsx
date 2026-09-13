import type { Money } from '@audio-commerce/shared';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatMoney(amount: Money): string {
  return inr.format(Number(amount));
}

function discountPercent(price: Money, compareAtPrice: Money): number {
  const off = ((Number(compareAtPrice) - Number(price)) / Number(compareAtPrice)) * 100;
  return Math.round(off);
}

export function Price({ from, to, compareAtPrice }: { from: Money; to: Money; compareAtPrice?: Money | null }) {
  const amount = from !== to ? `${formatMoney(from)} – ${formatMoney(to)}` : formatMoney(from);

  if (!compareAtPrice) {
    return <p className="text-ink">{amount}</p>;
  }

  return (
    <p className="flex flex-wrap items-baseline gap-2">
      <span className="text-lg font-semibold text-ink">{amount}</span>
      <span className="text-sm text-ink-muted line-through">{formatMoney(compareAtPrice)}</span>
      <span className="rounded-sm bg-sale/10 px-1.5 py-0.5 text-xs font-medium text-sale">
        {discountPercent(from, compareAtPrice)}% off
      </span>
    </p>
  );
}
