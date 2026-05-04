export type Row = {
  size: string;
  sales: number | string;
  proportion: number;
  available: number | string;
};

export function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;

  const text = String(value).trim().replace(/\s/g, "");
  if (text === "" || text === "-" || text === "," || text === ".") return fallback;

  const parsed = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function toPercent(value: number, digits = 1) {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${(normalized * 100).toFixed(digits)}%`;
}

export function normalizeProportions(rows: Row[]) {
  const sales = rows.map((row) => toNumber(row.sales, 0));
  const totalSales = sum(sales);

  if (totalSales > 0) {
    return rows.map((row, index) => ({ ...row, proportion: sales[index] / totalSales }));
  }

  const equalShare = rows.length ? 1 / rows.length : 0;
  return rows.map((row) => ({ ...row, proportion: equalShare }));
}

export function allocateOrder(rows: Row[], totalOrder: number) {
  const orderQty = Math.max(0, Math.floor(totalOrder));
  const normalizedRows = normalizeProportions(rows);
  const available = normalizedRows.map((row) => toNumber(row.available, 0));
  const availableTotal = sum(available);
  const targetTotal = availableTotal + orderQty;

  const targets = normalizedRows.map((row) => row.proportion * targetTotal);
  const deficits = normalizedRows.map((_, index) => Math.max(0, targets[index] - available[index]));
  const deficitTotal = sum(deficits);

  if (deficitTotal === 0 || orderQty <= 0) return rows.map(() => 0);

  const scale = orderQty / deficitTotal;
  const rawAllocation = deficits.map((deficit) => deficit * scale);
  const baseAllocation = rawAllocation.map((value) => Math.floor(value));
  let remainder = orderQty - sum(baseAllocation);

  const fractions = rawAllocation
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < fractions.length && remainder > 0; i += 1) {
    baseAllocation[fractions[i].index] += 1;
    remainder -= 1;
  }

  return baseAllocation;
}
