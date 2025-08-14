import React, { useMemo, useState, useEffect } from "react";
import * as XLSX from "xlsx";

// ---------- Helpers ----------
function toNumber(v: any, fallback = 0) {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const str = String(v).trim().replace(/\s/g, "");
  if (str === "" || str === "-" || str === "," || str === ".") return fallback;
  const n = parseFloat(str.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
function sum(arr: number[]) { return arr.reduce((a, b) => a + b, 0); }
function toPercent(x: number, digits = 1) {
  const n = Number.isFinite(x) ? x : 0;
  return (n * 100).toFixed(digits) + "%";
}

// ---------- Types ----------
export type Row = {
  size: string;
  sales: number | string;     // keep raw string while typing
  proportion: number;         // computed from sales
  available: number | string; // keep raw string while typing
};

// ---------- Core logic ----------
function normalizeProportions(rows: Row[]) {
  const sales = rows.map(r => toNumber(r.sales, 0));
  const s = sum(sales);
  if (s > 0) return rows.map((r, i) => ({ ...r, proportion: sales[i] / s }));
  const equal = rows.length ? 1 / rows.length : 0;
  return rows.map(r => ({ ...r, proportion: equal }));
}

function allocateOrder(rows: Row[], totalOrder: number) {
  const clean = normalizeProportions(rows);
  const availNums = clean.map(r => toNumber(r.available, 0));
  const availTotal = sum(availNums);
  const targetTotal = availTotal + Math.max(0, totalOrder);

  const target = clean.map((r) => r.proportion * targetTotal);
  const deficit = clean.map((r, i) => Math.max(0, target[i] - availNums[i]));
  const deficitSum = sum(deficit);
  if (deficitSum === 0 || totalOrder <= 0) return rows.map(() => 0);

  const scale = totalOrder / deficitSum;
  const raw = deficit.map(x => x * scale);

  const base = raw.map(x => Math.floor(x));
  let remainder = totalOrder - sum(base);
  const fracs = raw.map((x, idx) => ({ idx, frac: x - Math.floor(x) }));
  fracs.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < fracs.length && remainder > 0; i++) {
    base[fracs[i].idx] += 1;
    remainder -= 1;
  }
  return base;
}

// ---------- Defaults ----------
const defaultsBoat: Row[] = [
  { size: "XS", sales: "4",  proportion: 0, available: "4" },
  { size: "S",  sales: "47", proportion: 0, available: "47" },
  { size: "M",  sales: "22", proportion: 0, available: "22" },
  { size: "L",  sales: "38", proportion: 0, available: "38" },
  { size: "XL", sales: "3",  proportion: 0, available: "3" },
  { size: "XXL",sales: "2",  proportion: 0, available: "2" },
];
const defaultsVneck: Row[] = [
  { size: "XS", sales: "12", proportion: 0, available: "18" },
  { size: "S",  sales: "31", proportion: 0, available: "37" },
  { size: "M",  sales: "62", proportion: 0, available: "31" },
  { size: "L",  sales: "53", proportion: 0, available: "11" },
  { size: "XL", sales: "23", proportion: 0, available: "7" },
  { size: "XXL",sales: "26", proportion: 0, available: "0" },
];

// ---------- Top-level Section (keeps focus stable) ----------
type SectionProps = {
  title: string;
  rows: Row[];
  setRows: React.Dispatch<React.SetStateAction<Row[]>>;
  alloc: number[];
  orderQty: number;
  totalAvail: number;
  updateRowFunc: (setter: React.Dispatch<React.SetStateAction<Row[]>>, idx: number, key: keyof Row, value: string) => void;
  addRowFunc: (setter: React.Dispatch<React.SetStateAction<Row[]>>) => void;
  removeRowFunc: (setter: React.Dispatch<React.SetStateAction<Row[]>>, idx: number) => void;
};

function Section({ title, rows, setRows, alloc, orderQty, totalAvail, updateRowFunc, addRowFunc, removeRowFunc }: SectionProps) {
  const normalized = normalizeProportions(rows);
  return (
    <div className="bg-white rounded-2xl shadow p-4 md:p-6 w-full">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-gray-600">
            Order target: <b>{orderQty}</b> pcs · Available: <b>{totalAvail}</b> pcs · Proportion sum: <b>{toPercent(sum(normalized.map(r=>r.proportion)))}</b>
          </p>
        </div>
        <button className="text-sm px-3 py-2 rounded-xl border" onClick={() => addRowFunc(setRows)}>+ row</button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-3">Size</th>
              <th className="py-2 pr-3">Sales</th>
              <th className="py-2 pr-3">Proportion (from sales)</th>
              <th className="py-2 pr-3">Available</th>
              <th className="py-2 pr-3">Order (result)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-2 pr-3"><input className="w-20 border rounded-lg px-2 py-1" value={r.size} onChange={e => updateRowFunc(setRows, i, "size", e.target.value)} /></td>
                <td className="py-2 pr-3"><input type="text" inputMode="numeric" className="w-24 border rounded-lg px-2 py-1 text-right" value={String(r.sales)} onChange={e => updateRowFunc(setRows, i, "sales", e.target.value)} /></td>
                <td className="py-2 pr-3 text-right">{toPercent(normalized[i]?.proportion ?? 0, 2)}</td>
                <td className="py-2 pr-3"><input type="text" inputMode="numeric" className="w-28 border rounded-lg px-2 py-1 text-right" value={String(r.available)} onChange={e => updateRowFunc(setRows, i, "available", e.target.value)} /></td>
                <td className="py-2 pr-3 font-semibold text-right">{alloc[i] ?? 0}</td>
                <td className="py-2 pr-3 text-right"><button className="text-xs text-red-600" onClick={() => removeRowFunc(setRows, i)}>remove</button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 pr-3 font-medium">TOTAL</td>
              <td className="py-2 pr-3 text-right">{sum(rows.map(r=> toNumber(r.sales, 0)))}</td>
              <td className="py-2 pr-3 text-right">{toPercent(sum(normalized.map(r=>r.proportion)))}</td>
              <td className="py-2 pr-3 text-right">{sum(rows.map(r=> toNumber(r.available, 0)))}</td>
              <td className="py-2 pr-3 text-right font-semibold">{sum(alloc)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------- App ----------
export default function App() {
  const [twoVariants, setTwoVariants] = useState<boolean>(true);
  const [totalOrder, setTotalOrder] = useState<number>(800);
  const [splitBoat, setSplitBoat] = useState<number>(0.4); // boat neck share (0..1)
  const splitV = 1 - splitBoat;

  const [boat, setBoat] = useState<Row[]>(defaultsBoat);
  const [vneck, setVneck] = useState<Row[]>(defaultsVneck);

  // Dynamic document title
  useEffect(() => {
    document.title = `Size Order Allocator — ${twoVariants ? "Dual Variant" : "Single Variant"}`;
  }, [twoVariants]);

  // Presets (localStorage)
  type Preset = { name: string; totalOrder: number; splitBoat: number; twoVariants: boolean; boat: Row[]; vneck: Row[] };
  const STORAGE_KEY = "size_order_allocator_presets_v1";
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  useEffect(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setPresets(JSON.parse(raw)); } catch {}
  }, []);
  const savePresets = (list: Preset[]) => { setPresets(list); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {} };
  const handleSavePreset = () => {
    const name = presetName.trim() || `Preset ${new Date().toLocaleString()}`;
    const p: Preset = { name, totalOrder, splitBoat, twoVariants, boat, vneck };
    const idx = presets.findIndex(x => x.name === name);
    const next = [...presets];
    if (idx >= 0) next[idx] = p; else next.push(p);
    savePresets(next);
    setSelectedPreset(name);
  };
  const handleLoadPreset = (name: string) => {
    const p = presets.find(x => x.name === name);
    if (!p) return;
    setSelectedPreset(name);
    setTotalOrder(p.totalOrder);
    setSplitBoat(p.splitBoat);
    setTwoVariants(p.twoVariants);
    setBoat(p.boat);
    setVneck(p.vneck);
  };
  const handleDeletePreset = (name: string) => {
    const next = presets.filter(p => p.name !== name);
    savePresets(next);
    if (selectedPreset === name) setSelectedPreset("");
  };

  // Calculations
  const orderBoat = twoVariants ? Math.round(totalOrder * splitBoat) : totalOrder;
  const orderV = twoVariants ? totalOrder - orderBoat : 0;
  const boatAlloc = useMemo(() => allocateOrder(boat, orderBoat), [boat, orderBoat]);
  const vAlloc = useMemo(() => allocateOrder(vneck, orderV), [vneck, orderV]);
  const totalAvailBoat = sum(boat.map(r => toNumber(r.available, 0)));
  const totalAvailV = sum(vneck.map(r => toNumber(r.available, 0)));

  // Row editing (keep raw strings, parse only in math)
  function updateRow(setter: React.Dispatch<React.SetStateAction<Row[]>>, idx: number, key: keyof Row, value: string) {
    setter(prev => {
      const next = [...prev];
      const row = { ...next[idx] } as Row;
      if (key === "size") row.size = value;
      else if (key === "sales") row.sales = value;
      else if (key === "available") row.available = value;
      next[idx] = row;
      return next;
    });
  }
  function addRow(setter: React.Dispatch<React.SetStateAction<Row[]>>) {
    setter(prev => [...prev, { size: "", sales: "", proportion: 0, available: "" }]);
  }
  function removeRow(setter: React.Dispatch<React.SetStateAction<Row[]>>, idx: number) {
    setter(prev => prev.filter((_, i) => i !== idx));
  }

  // Export
  function exportXLSX() {
    const date = new Date().toISOString().slice(0,10);
    const wb = XLSX.utils.book_new();
    const makeSheet = (title: string, rows: Row[], alloc: number[]) => {
      const norm = normalizeProportions(rows);
      const data = rows.map((r, i) => ({
        Size: r.size,
        Sales: toNumber(r.sales, 0),
        Proportion: Number((norm[i]?.proportion ?? 0).toFixed(6)),
        Available: toNumber(r.available, 0),
        Order: alloc[i] ?? 0,
      }));
      return XLSX.utils.json_to_sheet(data);
    };
    const summary = [
      { Key: "Total order", Value: totalOrder },
      { Key: "Mode", Value: twoVariants ? "Boat neck + V-neck" : "Single product" },
      { Key: "Boat neck share", Value: twoVariants ? splitBoat : 1 },
      { Key: "V-neck share", Value: twoVariants ? 1 - splitBoat : 0 },
      { Key: "Order (Boat neck)", Value: twoVariants ? orderBoat : totalOrder },
      { Key: "Order (V-neck)", Value: twoVariants ? orderV : 0 },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary");
    XLSX.utils.book_append_sheet(wb, makeSheet(twoVariants ? "Boat neck" : "Product", boat, boatAlloc), twoVariants ? "Boat neck" : "Product");
    if (twoVariants) XLSX.utils.book_append_sheet(wb, makeSheet("V-neck", vneck, vAlloc), "V-neck");
    XLSX.writeFile(wb, `size_order_allocator_${date}.xlsx`);
  }
  function exportCSV() {
    const lines: string[] = [];
    const pushSection = (name: string, rows: Row[], alloc: number[]) => {
      const norm = normalizeProportions(rows);
      lines.push(`# ${name}`);
      lines.push("Size;Sales;Proportion;Available;Order");
      rows.forEach((r, i) => {
        lines.push([r.size, toNumber(r.sales, 0), (norm[i]?.proportion ?? 0).toFixed(6), toNumber(r.available, 0), alloc[i] ?? 0].join(";"));
      });
      lines.push("");
    };
    lines.push(`# Summary`);
    lines.push(`Total order;${totalOrder}`);
    lines.push(`Mode;${twoVariants ? "Boat neck + V-neck" : "Single product"}`);
    lines.push(`Boat neck share;${twoVariants ? splitBoat : 1}`);
    lines.push(`V-neck share;${twoVariants ? 1 - splitBoat : 0}`);
    lines.push("");
    pushSection(twoVariants ? "Boat neck" : "Product", boat, boatAlloc);
    if (twoVariants) pushSection("V-neck", vneck, vAlloc);

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "size-order-allocator.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Minimal console tests
  useEffect(() => {
    const assert = (name: string, cond: boolean) => { if (!cond) console.error(`TEST FAIL: ${name}`); else console.log(`TEST OK: ${name}`); };
    const rows1: Row[] = [
      { size: "A", sales: "1", proportion: 0, available: "0" },
      { size: "B", sales: "1", proportion: 0, available: "0" },
    ];
    const a1 = allocateOrder(rows1, 10);
    assert("sum=10, 5/5 split", sum(a1) === 10 && a1[0] === 5 && a1[1] === 5);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Size Order Allocator</h1>
            <p className="text-gray-600">Distribute an order across variants and sizes using stock and historical sales.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-2xl shadow">
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" checked={twoVariants} onChange={(e)=> setTwoVariants(e.target.checked)} />
              <span className="text-sm text-gray-700">Product has <b>two variants</b> (Boat neck / V-neck)</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Total order</span>
              <input type="number" className="w-28 border rounded-lg px-2 py-1 text-right" value={totalOrder}
                onChange={(e)=> setTotalOrder(Math.max(0, Math.floor(toNumber(e.target.value, 0))))} />
            </label>
            {twoVariants && (
              <label className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Boat neck share</span>
                <input type="number" step="0.01" className="w-28 border rounded-lg px-2 py-1 text-right" value={splitBoat}
                  onChange={(e)=> setSplitBoat(Math.max(0, Math.min(1, toNumber(e.target.value, 0))))} />
              </label>
            )}
            <div className="col-span-2 text-xs text-gray-600">
              {twoVariants ? (
                <>V-neck share = <b>{toPercent(splitV)}</b>, Boat neck = <b>{toPercent(splitBoat)}</b>. Orders: Boat <b>{orderBoat}</b> pcs, V-neck <b>{orderV}</b> pcs.</>
              ) : (
                <>Single product mode. The entire order goes into one table.</>
              )}
            </div>
          </div>
        </header>

        <div className={`grid gap-6 ${twoVariants ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
          <Section title={twoVariants ? "Variant: Boat neck" : "Product"} rows={boat} setRows={setBoat} alloc={boatAlloc} orderQty={orderBoat} totalAvail={totalAvailBoat} updateRowFunc={updateRow} addRowFunc={addRow} removeRowFunc={removeRow} />
          {twoVariants && (
            <Section title="Variant: V-neck" rows={vneck} setRows={setVneck} alloc={vAlloc} orderQty={orderV} totalAvail={totalAvailV} updateRowFunc={updateRow} addRowFunc={addRow} removeRowFunc={removeRow} />
          )}
        </div>

        <div className="bg-white rounded-2xl shadow p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-600">Total order</div>
              <div className="text-2xl font-bold">{totalOrder} pcs</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-600">Orders (Boat / V)</div>
              <div className="text-2xl font-bold">{sum(boatAlloc)} / {sum(vAlloc)} pcs</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-600">Integrity check</div>
              <div className={`text-2xl font-bold ${sum(boatAlloc) + sum(vAlloc) === totalOrder ? 'text-emerald-600' : 'text-red-600'}`}>
                {sum(boatAlloc) + sum(vAlloc)} / {totalOrder}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button className="px-4 py-2 rounded-xl border" onClick={exportXLSX}>Export XLSX</button>
            <button className="px-4 py-2 rounded-xl border" onClick={exportCSV}>Export CSV</button>

            <div className="ml-auto flex items-center gap-2">
              <input className="border rounded-lg px-2 py-1" placeholder="Preset name" value={presetName} onChange={e=>setPresetName(e.target.value)} />
              <button className="px-3 py-2 rounded-xl border" onClick={handleSavePreset}>Save preset</button>
              <select className="border rounded-lg px-2 py-2" value={selectedPreset} onChange={e=> handleLoadPreset(e.target.value)}>
                <option value="">– load preset –</option>
                {presets.map(p=> <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
              {selectedPreset && <button className="px-3 py-2 rounded-xl border text-red-600" onClick={()=>handleDeletePreset(selectedPreset)}>Delete preset</button>}
            </div>
          </div>

          <p className="mt-3 text-gray-600 text-sm">
            Algorithm: target final stock = proportion × (available + order). Per-size order = max(0, target − available),
            then scale and round via largest remainders to hit the exact total.
          </p>
        </div>

        <footer className="text-xs text-gray-500">
          Tip: “Sales” and “Available” inputs keep raw text while typing (inputMode=numeric) — no cursor jumping; parsing happens in calculations.
        </footer>
      </div>
    </div>
  );
}
