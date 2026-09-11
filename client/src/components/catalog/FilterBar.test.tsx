import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar.js';

const values = {
  q: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  inStock: false,
  sort: 'newest' as const,
};

function desktopSort(): HTMLElement {
  const sort = document.getElementById('filter-desktop-sort');
  expect(sort).not.toBeNull();
  expect(sort!.closest('details')).toBeNull();
  return sort!;
}

describe('FilterBar', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth });
  });

  it('renders a named filter form and reports sort changes to the parent', async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        values={values}
        brands={[{ slug: 'aurelia', name: 'Aurelia' }]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('form', { name: 'Filter products' })).toBeInTheDocument();
    await userEvent.selectOptions(desktopSort(), 'price_asc');
    expect(onChange).toHaveBeenCalledWith({ sort: 'price_asc' });
  });

  it('keeps filter fields reachable at md+ without depending on mount innerWidth', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    const onChange = vi.fn();
    render(
      <FilterBar
        values={values}
        brands={[{ slug: 'aurelia', name: 'Aurelia' }]}
        onChange={onChange}
      />,
    );
    const sort = desktopSort();
    expect(sort.closest('details')).toBeNull();
    await userEvent.selectOptions(sort, 'price_asc');
    expect(onChange).toHaveBeenCalledWith({ sort: 'price_asc' });
  });
});
