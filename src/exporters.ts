import * as XLSX from "xlsx";

import { normalizeProportions, toNumber, type Row } from "./allocation";

type ExportParams = {
  totalOrder: number;
  twoVariants: boolean;
  splitBoat: number;
  orderBoat: number;
  orderV: number;
  boat: Row[];
  vneck: Row[];
  boatAlloc: number[];
  vAlloc: number[];
};

function modeLabel(twoVariants: boolean) {
  return twoVariants ? "Boat neck + V-neck" : "Single product";
}

function makeSheet(rows: Row[], allocation: number[]) {
  const normalized = normalizeProportions(rows);
  const data = rows.map((row, index) => ({
    Size: row.size,
    Sales: toNumber(row.sales, 0),
    Proportion: Number((normalized[index]?.proportion ?? 0).toFixed(6)),
    Available: toNumber(row.available, 0),
    Order: allocation[index] ?? 0,
  }));

  return XLSX.utils.json_to_sheet(data);
}

export function exportXLSX(params: ExportParams) {
  const date = new Date().toISOString().slice(0, 10);
  const workbook = XLSX.utils.book_new();
  const summary = [
    { Key: "Total order", Value: params.totalOrder },
    { Key: "Mode", Value: modeLabel(params.twoVariants) },
    { Key: "Boat neck share", Value: params.twoVariants ? params.splitBoat : 1 },
    { Key: "V-neck share", Value: params.twoVariants ? 1 - params.splitBoat : 0 },
    { Key: "Order (Boat neck)", Value: params.twoVariants ? params.orderBoat : params.totalOrder },
    { Key: "Order (V-neck)", Value: params.twoVariants ? params.orderV : 0 },
  ];

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "Summary");
  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet(params.boat, params.boatAlloc),
    params.twoVariants ? "Boat neck" : "Product",
  );

  if (params.twoVariants) {
    XLSX.utils.book_append_sheet(workbook, makeSheet(params.vneck, params.vAlloc), "V-neck");
  }

  XLSX.writeFile(workbook, `size_order_allocator_${date}.xlsx`);
}

export function exportCSV(params: ExportParams) {
  const lines: string[] = [];

  const pushSection = (name: string, rows: Row[], allocation: number[]) => {
    const normalized = normalizeProportions(rows);
    lines.push(`# ${name}`);
    lines.push("Size;Sales;Proportion;Available;Order");
    rows.forEach((row, index) => {
      lines.push([
        row.size,
        toNumber(row.sales, 0),
        (normalized[index]?.proportion ?? 0).toFixed(6),
        toNumber(row.available, 0),
        allocation[index] ?? 0,
      ].join(";"));
    });
    lines.push("");
  };

  lines.push("# Summary");
  lines.push(`Total order;${params.totalOrder}`);
  lines.push(`Mode;${modeLabel(params.twoVariants)}`);
  lines.push(`Boat neck share;${params.twoVariants ? params.splitBoat : 1}`);
  lines.push(`V-neck share;${params.twoVariants ? 1 - params.splitBoat : 0}`);
  lines.push("");
  pushSection(params.twoVariants ? "Boat neck" : "Product", params.boat, params.boatAlloc);

  if (params.twoVariants) pushSection("V-neck", params.vneck, params.vAlloc);

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "size-order-allocator.csv";
  link.click();
  URL.revokeObjectURL(url);
}
