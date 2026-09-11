import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination.js';

describe('Pagination', () => {
  it('clicking page 2 calls onPage(2)', async () => {
    const onPage = vi.fn();
    render(<Pagination page={1} totalPages={3} onPage={onPage} />);
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it('disabled prev on page 1 has aria-disabled', () => {
    render(<Pagination page={1} totalPages={3} onPage={() => {}} />);
    const prev = screen.getByRole('button', { name: /previous/i });
    expect(prev).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
  });

  it('windows page links to first, last, and current ± 2', () => {
    render(<Pagination page={10} totalPages={50} onPage={() => {}} />);
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    const numbered = within(nav)
      .getAllByRole('button')
      .filter((button) => /^\d+$/.test(button.textContent ?? ''));
    expect(numbered.map((button) => button.textContent)).toEqual(['1', '8', '9', '10', '11', '12', '50']);
  });
});
