export function availableQty(stockQty: number, reservedQty: number): number {
  return stockQty - reservedQty;
}

export function variantInStock(stockQty: number, reservedQty: number): boolean {
  return availableQty(stockQty, reservedQty) > 0;
}

export function productInStock(variants: { stockQty: number; reservedQty: number }[]): boolean {
  return variants.some((v) => variantInStock(v.stockQty, v.reservedQty));
}
