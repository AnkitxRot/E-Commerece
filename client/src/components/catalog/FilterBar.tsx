import type { FormEvent } from 'react';
import type { BrandSummary, CatalogSort } from '@audio-commerce/shared';
import { Button } from '../Button.js';
import { Input } from '../Input.js';

export type FilterBarValues = {
  q: string;
  brand: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  sort: CatalogSort;
};

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A–Z' },
  { value: 'name_desc', label: 'Name: Z–A' },
];

const fieldClass =
  'rounded-md border border-border bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent';

function FilterFields({
  idPrefix,
  values,
  brands,
  onChange,
}: {
  idPrefix: string;
  values: FilterBarValues;
  brands: BrandSummary[];
  onChange: (patch: Record<string, string | undefined>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-2 md:p-0 lg:grid-cols-3">
      <Input
        id={`${idPrefix}-q`}
        label="Search"
        value={values.q}
        onChange={(event) => onChange({ q: event.target.value })}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-brand`} className="text-sm font-medium text-ink">
          Brand
        </label>
        <select
          id={`${idPrefix}-brand`}
          className={fieldClass}
          value={values.brand}
          onChange={(event) => onChange({ brand: event.target.value || undefined })}
        >
          <option value="">All brands</option>
          {brands.map((brand) => (
            <option key={brand.slug} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>
      <Input
        id={`${idPrefix}-min-price`}
        label="Min price"
        inputMode="decimal"
        value={values.minPrice}
        onChange={(event) => onChange({ minPrice: event.target.value || undefined })}
      />
      <Input
        id={`${idPrefix}-max-price`}
        label="Max price"
        inputMode="decimal"
        value={values.maxPrice}
        onChange={(event) => onChange({ maxPrice: event.target.value || undefined })}
      />
      <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={values.inStock}
          onChange={(event) => onChange({ inStock: event.target.checked ? 'true' : undefined })}
        />
        In stock
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-sort`} className="text-sm font-medium text-ink">
          Sort
        </label>
        <select
          id={`${idPrefix}-sort`}
          className={fieldClass}
          value={values.sort}
          onChange={(event) => onChange({ sort: event.target.value })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
      </div>
    </div>
  );
}

export function FilterBar({
  values,
  brands,
  onChange,
  onSubmit,
}: {
  values: FilterBarValues;
  brands: BrandSummary[];
  onChange: (patch: Record<string, string | undefined>) => void;
  onSubmit?: (values: FilterBarValues) => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(values);
  }

  return (
    <form aria-label="Filter products" onSubmit={handleSubmit} className="text-ink">
      <details className="rounded-md border border-border md:hidden">
        <summary className="min-h-[44px] cursor-pointer px-3 py-2">Filters</summary>
        <FilterFields idPrefix="filter-mobile" values={values} brands={brands} onChange={onChange} />
      </details>
      <div className="hidden md:block">
        <FilterFields idPrefix="filter-desktop" values={values} brands={brands} onChange={onChange} />
      </div>
    </form>
  );
}
