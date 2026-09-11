import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar.js';

const values = {
  q: '',
  brand: '',
  minPrice: '',
  maxPrice: '',
  inStock: false,
  sort: 'newest' as const,
};

describe('FilterBar', () => {
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
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'price_asc');
    expect(onChange).toHaveBeenCalledWith({ sort: 'price_asc' });
  });
});
