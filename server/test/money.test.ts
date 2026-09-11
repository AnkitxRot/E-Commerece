import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { availableQty, productInStock, variantInStock } from '../src/modules/catalog/availability.js';
import { escapeIlike } from '../src/modules/catalog/ilike.js';
import { toMoney } from '../src/modules/catalog/money.js';

describe('toMoney', () => {
  it('serializes Decimal to two fraction digits', () => {
    expect(toMoney(new Decimal('10.5'))).toBe('10.50');
    expect(toMoney(new Decimal(19999))).toBe('19999.00');
  });
});

describe('availability', () => {
  it('is stockQty minus reservedQty and inStock when > 0', () => {
    expect(availableQty(5, 4)).toBe(1);
    expect(variantInStock(5, 4)).toBe(true);
    expect(variantInStock(1, 1)).toBe(false);
    expect(productInStock([{ stockQty: 1, reservedQty: 1 }])).toBe(false);
    expect(productInStock([{ stockQty: 5, reservedQty: 4 }])).toBe(true);
    expect(productInStock([])).toBe(false);
  });
});

describe('escapeIlike', () => {
  it('escapes ILIKE metacharacters', () => {
    expect(escapeIlike('100%_off\\x')).toBe('100\\%\\_off\\\\x');
  });
});
