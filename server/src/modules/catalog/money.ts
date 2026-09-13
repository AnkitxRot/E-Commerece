import { Decimal } from '@prisma/client/runtime/library';

export function toMoney(value: Decimal | string | number): string {
  return new Decimal(value).toFixed(2);
}

export function toMoneyNullable(value: Decimal | string | number | null): string | null {
  return value === null ? null : toMoney(value);
}
