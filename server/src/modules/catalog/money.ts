import { Decimal } from '@prisma/client/runtime/library';

export function toMoney(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}
