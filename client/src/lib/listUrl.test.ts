import { describe, expect, it } from 'vitest';
import { writeListParams } from './listUrl.js';

describe('writeListParams', () => {
  it('resets page on filter changes and omits defaults', () => {
    const current = new URLSearchParams('page=3&sort=price_asc');
    const next = writeListParams(current, { sort: 'newest' }, 'filter');
    expect(next.get('page')).toBeNull();
    expect(next.get('sort')).toBeNull();
  });

  it('pushes page without dropping sort', () => {
    const current = new URLSearchParams('sort=name_asc');
    const next = writeListParams(current, { page: '2' }, 'page');
    expect(next.get('page')).toBe('2');
    expect(next.get('sort')).toBe('name_asc');
  });
});
