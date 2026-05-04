import React, { useEffect, useMemo, useState } from "react";

import {
  allocateOrder,
  normalizeProportions,
  sum,
  toNumber,
  toPercent,
  type Row,
} from "./allocation";
import { exportCSV, exportXLSX } from "./exporters";

const defaultsBoat: Row[] = [
  { size: "XS", sales: "4", proportion: 0, available: "4" },
  { size: "S", sales: "47", proportion: 0, available: "47" },
  { size: "M", sales: "22", proportion: 0, available: "22" },
  { size: "L", sales: "38", proportion: 0, available: "38" },
  { size: "XL", sales: "3", proportion: 0, available: "3" },
  { size: "XXL", sales: "2", proportion: 0, available: "2" },
];

const defaultsVneck: Row[] = [
  { size: "XS", sales: "12", proportion: 0, available: "18" },
  { size: "S", sales: "31", proportion: 0, available: "37" },
  { size: "M", sales: "62", proportion: 0, available: "31" },
  { size: "L", sales: "53", proportion: 0, available: "11" },
  { size: "XL", sales: "23", proportion: 0, available: "7" },
  { size: "XXL", sales: "26", proportion: 0, available: "0" },
];

type Preset = {
  name: string;
  totalOrder: number;
  splitBoat: number;
  twoVariants: boolean;
  boat: Row[];
  vneck: Row[];
};

type RowSetter = React.Dispatch<React.SetStateAction<Row[]>>;

type SectionProps = {
  title: string;
  rows: Row[];
  setRows: RowSetter;
  alloc: number[];
  orderQty: number;
  totalAvail: number;
  onEntryKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  updateRowFunc: (setter: RowSetter, idx: number, key: keyof Row, value: string) => void;
  addRowFunc: (setter: RowSetter) => void;
  removeRowFunc: (setter: RowSetter, idx: number) => void;
};

type MetricCardProps = {
  label: string;
  value: string;
  accent: string;
};

const STORAGE_KEY = "size_order_allocator_presets_v1";
const inputClass =
  "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const buttonClass =
  "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100";

function MetricCard({ label, value, accent }: MetricCardProps) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${accent}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Section({
  title,
  rows,
  setRows,
  alloc,
  orderQty,
  totalAvail,
  onEntryKeyDown,
  updateRowFunc,
  addRowFunc,
  removeRowFunc,
}: SectionProps) {
  const normalized = normalizeProportions(rows);

  return (
    <section className="w-full rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">
            Target <b>{orderQty}</b> pcs | Available <b>{totalAvail}</b> pcs | Proportion sum{" "}
            <b>{toPercent(sum(normalized.map((row) => row.proportion)))}</b>
          </p>
        </div>
        <button className={buttonClass} onClick={() => addRowFunc(setRows)} type="button">
          + row
        </button>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3">Size</th>
              <th className="px-3 py-3 text-right">Sales</th>
              <th className="px-3 py-3 text-right">Proportion</th>
              <th className="px-3 py-3 text-right">Available</th>
              <th className="px-3 py-3 text-right">Order</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index} className="transition hover:bg-slate-50">
                <td className="px-4 py-2">
                  <input
                    className={`${inputClass} w-20 font-medium`}
                    data-entry-input="true"
                    value={row.size}
                    onChange={(event) => updateRowFunc(setRows, index, "size", event.target.value)}
                    onKeyDown={onEntryKeyDown}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`${inputClass} w-24 text-right`}
                    data-entry-input="true"
                    value={String(row.sales)}
                    onChange={(event) => updateRowFunc(setRows, index, "sales", event.target.value)}
                    onKeyDown={onEntryKeyDown}
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-700">{toPercent(normalized[index]?.proportion ?? 0, 2)}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="text"
                    inputMode="decimal"
                    className={`${inputClass} w-24 text-right`}
                    data-entry-input="true"
                    value={String(row.available)}
                    onChange={(event) => updateRowFunc(setRows, index, "available", event.target.value)}
                    onKeyDown={onEntryKeyDown}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex min-w-10 justify-center rounded-md bg-cyan-50 px-2 py-1 font-semibold text-cyan-800">
                    {alloc[index] ?? 0}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                    onClick={() => removeRowFunc(setRows, index)}
                    type="button"
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800">
            <tr>
              <td className="px-4 py-3">TOTAL</td>
              <td className="px-3 py-3 text-right">{sum(rows.map((row) => toNumber(row.sales, 0)))}</td>
              <td className="px-3 py-3 text-right">{toPercent(sum(normalized.map((row) => row.proportion)))}</td>
              <td className="px-3 py-3 text-right">{sum(rows.map((row) => toNumber(row.available, 0)))}</td>
              <td className="px-3 py-3 text-right">{sum(alloc)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [twoVariants, setTwoVariants] = useState<boolean>(true);
  const [totalOrder, setTotalOrder] = useState<number>(800);
  const [splitBoat, setSplitBoat] = useState<number>(0.4);
  const [boat, setBoat] = useState<Row[]>(defaultsBoat);
  const [vneck, setVneck] = useState<Row[]>(defaultsVneck);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("");

  const splitV = 1 - splitBoat;
  const orderBoat = twoVariants ? Math.round(totalOrder * splitBoat) : totalOrder;
  const orderV = twoVariants ? totalOrder - orderBoat : 0;
  const boatAlloc = useMemo(() => allocateOrder(boat, orderBoat), [boat, orderBoat]);
  const vAlloc = useMemo(() => allocateOrder(vneck, orderV), [vneck, orderV]);
  const totalAvailBoat = sum(boat.map((row) => toNumber(row.available, 0)));
  const totalAvailV = sum(vneck.map((row) => toNumber(row.available, 0)));
  const totalAllocated = sum(boatAlloc) + sum(vAlloc);
  const exportParams = { totalOrder, twoVariants, splitBoat, orderBoat, orderV, boat, vneck, boatAlloc, vAlloc };

  useEffect(() => {
    document.title = `Size Order Allocator - ${twoVariants ? "Dual Variant" : "Single Variant"}`;
  }, [twoVariants]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {
      setPresets([]);
    }
  }, []);

  useEffect(() => {
    const rows1: Row[] = [
      { size: "A", sales: "1", proportion: 0, available: "0" },
      { size: "B", sales: "1", proportion: 0, available: "0" },
    ];
    const allocation = allocateOrder(rows1, 10);
    const ok = sum(allocation) === 10 && allocation[0] === 5 && allocation[1] === 5;
    if (!ok) console.error("TEST FAIL: allocation should split 10 as 5/5", allocation);
  }, []);

  function focusNextEntry(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("[data-entry-input='true']"));
    const currentIndex = inputs.indexOf(event.currentTarget);
    const nextInput = inputs[currentIndex + 1];

    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    } else {
      event.currentTarget.blur();
    }
  }

  function savePresets(list: Preset[]) {
    setPresets(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Presets are optional; ignore private-mode or quota failures.
    }
  }

  function handleSavePreset() {
    const name = presetName.trim() || `Preset ${new Date().toLocaleString()}`;
    const preset: Preset = { name, totalOrder, splitBoat, twoVariants, boat, vneck };
    const index = presets.findIndex((item) => item.name === name);
    const next = [...presets];

    if (index >= 0) next[index] = preset;
    else next.push(preset);

    savePresets(next);
    setSelectedPreset(name);
  }

  function handleLoadPreset(name: string) {
    const preset = presets.find((item) => item.name === name);
    if (!preset) return;

    setSelectedPreset(name);
    setTotalOrder(preset.totalOrder);
    setSplitBoat(preset.splitBoat);
    setTwoVariants(preset.twoVariants);
    setBoat(preset.boat);
    setVneck(preset.vneck);
  }

  function handleDeletePreset(name: string) {
    const next = presets.filter((preset) => preset.name !== name);
    savePresets(next);
    if (selectedPreset === name) setSelectedPreset("");
  }

  function updateRow(setter: RowSetter, index: number, key: keyof Row, value: string) {
    setter((prev) => {
      const next = [...prev];
      const row = { ...next[index] };

      if (key === "size") row.size = value;
      else if (key === "sales") row.sales = value;
      else if (key === "available") row.available = value;

      next[index] = row;
      return next;
    });
  }

  function addRow(setter: RowSetter) {
    setter((prev) => [...prev, { size: "", sales: "", proportion: 0, available: "" }]);
  }

  function removeRow(setter: RowSetter, index: number) {
    setter((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Order planning</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Size Order Allocator</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Distribute an order across variants and sizes using stock, historical sales, and the current variant split.
              </p>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:min-w-[520px]">
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  type="checkbox"
                  checked={twoVariants}
                  onChange={(event) => setTwoVariants(event.target.checked)}
                />
                <span className="text-sm text-slate-700">
                  Product has <b>two variants</b> (Boat neck / V-neck)
                </span>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Total order</span>
                <input
                  type="number"
                  className={`${inputClass} w-full text-right`}
                  data-entry-input="true"
                  value={totalOrder}
                  onChange={(event) => setTotalOrder(Math.max(0, Math.floor(toNumber(event.target.value, 0))))}
                  onKeyDown={focusNextEntry}
                />
              </label>

              {twoVariants && (
                <label className="space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Boat neck share</span>
                  <input
                    type="number"
                    step="0.01"
                    className={`${inputClass} w-full text-right`}
                    data-entry-input="true"
                    value={splitBoat}
                    onChange={(event) => setSplitBoat(Math.max(0, Math.min(1, toNumber(event.target.value, 0))))}
                    onKeyDown={focusNextEntry}
                  />
                </label>
              )}

              <div className="rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 sm:col-span-2">
                {twoVariants ? (
                  <>
                    Boat <b>{toPercent(splitBoat)}</b> / V-neck <b>{toPercent(splitV)}</b>. Orders: Boat <b>{orderBoat}</b> pcs, V-neck{" "}
                    <b>{orderV}</b> pcs.
                  </>
                ) : (
                  <>Single product mode. The whole order goes into the first table.</>
                )}
              </div>
            </div>
          </div>
        </header>

        <div className={`grid gap-5 ${twoVariants ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
          <Section
            title={twoVariants ? "Variant: Boat neck" : "Product"}
            rows={boat}
            setRows={setBoat}
            alloc={boatAlloc}
            orderQty={orderBoat}
            totalAvail={totalAvailBoat}
            onEntryKeyDown={focusNextEntry}
            updateRowFunc={updateRow}
            addRowFunc={addRow}
            removeRowFunc={removeRow}
          />
          {twoVariants && (
            <Section
              title="Variant: V-neck"
              rows={vneck}
              setRows={setVneck}
              alloc={vAlloc}
              orderQty={orderV}
              totalAvail={totalAvailV}
              onEntryKeyDown={focusNextEntry}
              updateRowFunc={updateRow}
              addRowFunc={addRow}
              removeRowFunc={removeRow}
            />
          )}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
              <p className="mt-1 text-sm text-slate-600">Review totals, export files, and save reusable presets.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className={buttonClass} onClick={() => exportXLSX(exportParams)} type="button">
                Export XLSX
              </button>
              <button className={buttonClass} onClick={() => exportCSV(exportParams)} type="button">
                Export CSV
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label="Total order" value={`${totalOrder} pcs`} accent="border-l-4 border-l-cyan-500" />
            <MetricCard label="Orders Boat / V" value={`${sum(boatAlloc)} / ${sum(vAlloc)} pcs`} accent="border-l-4 border-l-amber-500" />
            <MetricCard
              label="Integrity check"
              value={`${totalAllocated} / ${totalOrder}`}
              accent={`border-l-4 ${totalAllocated === totalOrder ? "border-l-emerald-500" : "border-l-rose-500"}`}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 lg:flex-row lg:items-center">
            <input
              className={`${inputClass} w-full lg:w-64`}
              placeholder="Preset name"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
            />
            <button className={buttonClass} onClick={handleSavePreset} type="button">
              Save preset
            </button>
            <select
              className={`${inputClass} w-full lg:w-64`}
              value={selectedPreset}
              onChange={(event) => handleLoadPreset(event.target.value)}
            >
              <option value="">- load preset -</option>
              {presets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
            </select>
            {selectedPreset && (
              <button className={`${buttonClass} text-rose-600 hover:border-rose-400 hover:text-rose-700`} onClick={() => handleDeletePreset(selectedPreset)} type="button">
                Delete preset
              </button>
            )}
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Algorithm: target final stock = proportion x (available + order). Per-size order = max(0, target - available), then scale and
            round via largest remainders to hit the exact total.
          </p>
        </section>
      </div>
    </div>
  );
}
