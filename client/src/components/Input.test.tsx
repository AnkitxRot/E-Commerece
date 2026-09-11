import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input.js';

describe('Input', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input id="email" label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows an error message and marks the field invalid', () => {
    render(<Input id="email" label="Email" error="Email is required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });
});
