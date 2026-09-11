import type { VariantDto } from '@audio-commerce/shared';

function attributeKeys(variants: VariantDto[]): string[] {
  const keys = new Set<string>();
  for (const variant of variants) {
    for (const key of Object.keys(variant.attributes)) keys.add(key);
  }
  return [...keys].sort((a, b) => {
    if (a === 'color') return -1;
    if (b === 'color') return 1;
    return a.localeCompare(b);
  });
}

function isHomogeneous(variants: VariantDto[], keys: string[]): boolean {
  return variants.every(
    (variant) => keys.every((key) => key in variant.attributes) && Object.keys(variant.attributes).length === keys.length,
  );
}

function valuesFor(variants: VariantDto[], key: string): string[] {
  const values: string[] = [];
  for (const variant of variants) {
    const value = variant.attributes[key];
    if (value && !values.includes(value)) values.push(value);
  }
  return values;
}

const chip =
  'min-h-[44px] rounded-md border border-border bg-surface px-3 text-sm text-ink duration-snap aria-checked:border-ink';

export function VariantPicker({
  variants,
  selectedSku,
  onSelect,
}: {
  variants: VariantDto[];
  selectedSku: string | null;
  onSelect: (sku: string) => void;
}) {
  if (variants.length === 0) return null;

  const selected = variants.find((variant) => variant.sku === selectedSku) ?? variants[0];
  const keys = attributeKeys(variants);
  const grouped = keys.length > 0 && isHomogeneous(variants, keys);

  if (!grouped) {
    return (
      <div role="radiogroup" aria-label="Variant" className="flex flex-wrap gap-2">
        {variants.map((variant) => (
          <button
            key={variant.sku}
            type="button"
            role="radio"
            aria-checked={variant.sku === selected.sku}
            className={chip}
            onClick={() => onSelect(variant.sku)}
          >
            {variant.sku}
          </button>
        ))}
      </div>
    );
  }

  function selectValue(key: string, value: string) {
    const nextAttrs = { ...selected.attributes, [key]: value };
    const exact = variants.find((variant) => keys.every((attr) => variant.attributes[attr] === nextAttrs[attr]));
    const fallback = variants.find((variant) => variant.attributes[key] === value);
    const sku = exact?.sku ?? fallback?.sku;
    if (sku) onSelect(sku);
  }

  return (
    <div className="flex flex-col gap-4">
      {keys.map((key) => (
        <div key={key} role="radiogroup" aria-label={key} className="flex flex-wrap gap-2">
          {valuesFor(variants, key).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected.attributes[key] === value}
              className={chip}
              onClick={() => selectValue(key, value)}
            >
              {value}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
