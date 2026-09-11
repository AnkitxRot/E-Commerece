import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Price } from './Price.js';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

describe('Price', () => {
  it('formats a single INR amount when from equals to', () => {
    render(<Price from="19999.00" to="19999.00" />);
    expect(screen.getByText(inr.format(19999))).toBeInTheDocument();
  });

  it('formats an INR range when from and to differ', () => {
    render(<Price from="19999.00" to="24999.00" />);
    expect(screen.getByText(`${inr.format(19999)} – ${inr.format(24999)}`)).toBeInTheDocument();
  });
});
