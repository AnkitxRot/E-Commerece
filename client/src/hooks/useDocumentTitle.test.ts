import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle.js';

describe('useDocumentTitle', () => {
  it('sets document.title to the given string', () => {
    renderHook(() => useDocumentTitle('Checkout'));
    expect(document.title).toBe('Checkout');
  });

  it('updates document.title when the value changes', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Order details' },
    });
    expect(document.title).toBe('Order details');

    rerender({ title: 'Order confirmed' });
    expect(document.title).toBe('Order confirmed');
  });

  it('leaves the existing title untouched for a null or undefined value', () => {
    document.title = 'Aurelia Audio';
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: undefined as string | null | undefined },
    });
    expect(document.title).toBe('Aurelia Audio');

    rerender({ title: null });
    expect(document.title).toBe('Aurelia Audio');
  });
});
