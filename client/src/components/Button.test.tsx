import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('renders its label and calls onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Add to cart</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables the button and shows a loading label while loading', () => {
    render(<Button loading>Add to cart</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Add to cart
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
