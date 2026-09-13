import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { VariantDto } from '@audio-commerce/shared';
import { VariantPicker } from './VariantPicker.js';

const variants: VariantDto[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    sku: 'HEL-BLK-01',
    attributes: { color: 'Midnight' },
    price: '52990.00',
    compareAtPrice: null,
    inStock: true,
    availableQty: 5,
  },
  {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    sku: 'HEL-OOS-01',
    attributes: { color: 'Ivory' },
    price: '52990.00',
    compareAtPrice: null,
    inStock: false,
    availableQty: 0,
  },
];

describe('VariantPicker', () => {
  it('uses a radiogroup whose chips show the color name, never color-only', async () => {
    const onSelect = vi.fn();
    render(<VariantPicker variants={variants} selectedSku="HEL-BLK-01" onSelect={onSelect} />);

    const group = screen.getByRole('radiogroup', { name: 'color' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Midnight' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Ivory' })).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(screen.getByRole('radio', { name: 'Ivory' }));
    expect(onSelect).toHaveBeenCalledWith('HEL-OOS-01');
  });
});
