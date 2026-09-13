import { describe, expect, it } from 'vitest';
import { addWishlistItemSchema } from './wishlist.js';

describe('addWishlistItemSchema', () => {
  it('accepts a valid slug', () => {
    const result = addWishlistItemSchema.safeParse({ slug: 'aurelia-nova' });
    expect(result.success).toBe(true);
  });

  it('rejects a missing slug', () => {
    expect(addWishlistItemSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a non-string slug', () => {
    expect(addWishlistItemSchema.safeParse({ slug: 123 }).success).toBe(false);
  });

  it('rejects a malformed slug', () => {
    expect(addWishlistItemSchema.safeParse({ slug: 'Not A Slug!' }).success).toBe(false);
  });

  it('rejects unknown extra fields', () => {
    expect(addWishlistItemSchema.safeParse({ slug: 'aurelia-nova', productId: 'x' }).success).toBe(false);
  });
});
