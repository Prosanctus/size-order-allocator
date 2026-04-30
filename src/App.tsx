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
  updateRowFunc: (setter: RowSetter, idx: number, key: keyof Row, value: string) => void;
  addRowFunc: (setter: RowSetter) => void;
  removeRowFunc: (setter: RowSetter, idx: number) => void;
};

const STORAGE_KEY = "size_order_allocator_presets_v1";

function Section({
  title,
  rows,
  setRows,
  alloc,
  orderQty,
  totalAvail,
  updateRowFunc,
  addRowFunc,
  removeRowFunc,
}: SectionProps) {
  const normalized = normalizeProportions(rows);

  return (
    <div className="bg-white rounded-2xl shadow p-4 md:p-6 w-full">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-gray-600">
            Order target: <b>{orderQty}</b> pcs · Available: <b>{totalAvail}</b> pcs · Proportion sum:{" "}
            <b>{toPercent(sum(normalized.map((row) => row.proportion)))}</b>
          </p>
        </div>
        <button className="text-sm px-3 py-2 rounded-xl border" onClick={() => addRowFunc(setRows)}>
          + row
        </button>
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
            {rows.map((row, index) => (
              <tr key={index} className="border-b last:border-b-0">
                <td className="py-2 pr-3">
                  <input
                    className="w-20 border rounded-lg px-2 py-1"
                    value={row.size}
                    onChange={(event) => updateRowFunc(setRows, index, "size", event.target.value)}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-24 border rounded-lg px-2 py-1 text-right"
                    value={String(row.sales)}
                    onChange={(event) => updateRowFunc(setRows, index, "sales", event.target.value)}
                  />
                </td>
                <td className="py-2 pr-3 text-right">{toPercent(normalized[index]?.proportion ?? 0, 2)}</td>
                <td className="py-2 pr-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-28 border rounded-lg px-2 py-1 text-right"
                    value={String(row.available)}
                    onChange={(event) => updateRowFunc(setRows, index, "available", event.target.value)}
                  />
                </td>
                <td className="py-2 pr-3 font-semibold text-right">{alloc[index] ?? 0}</td>
                <td className="py-2 pr-3 text-right">
                  <button className="text-xs text-red-600" onClick={() => removeRowFunc(setRows, index)}>
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="py-2 pr-3 font-medium">TOTAL</td>
              <td className="py-2 pr-3 text-right">{sum(rows.map((row) => toNumber(row.sales, 0)))}</td>
              <td className="py-2 pr-3 text-right">{toPercent(sum(normalized.map((row) => row.proportion)))}</td>
              <td className="py-2 pr-3 text-right">{sum(rows.map((row) => toNumber(row.available, 0)))}</td>
              <td className="py-2 pr-3 text-right font-semibold">{sum(alloc)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Size Order Allocator</h1>
            <p className="text-gray-600">Distribute an order across variants and sizes using stock and historical sales.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-white p-4 rounded-2xl shadow">
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" checked={twoVariants} onChange={(event) => setTwoVariants(event.target.checked)} />
              <span className="text-sm text-gray-700">
                Product has <b>two variants</b> (Boat neck / V-neck)
              </span>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Total order</span>
              <input
                type="number"
                className="w-28 border rounded-lg px-2 py-1 text-right"
                value={totalOrder}
                onChange={(event) => setTotalOrder(Math.max(0, Math.floor(toNumber(event.target.value, 0))))}
              />
            </label>
            {twoVariants && (
              <label className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Boat neck share</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-28 border rounded-lg px-2 py-1 text-right"
                  value={splitBoat}
                  onChange={(event) => setSplitBoat(Math.max(0, Math.min(1, toNumber(event.target.value, 0))))}
                />
              </label>
            )}
            <div className="col-span-2 text-xs text-gray-600">
              {twoVariants ? (
                <>
                  V-neck share = <b>{toPercent(splitV)}</b>, Boat neck = <b>{toPercent(splitBoat)}</b>. Orders: Boat{" "}
                  <b>{orderBoat}</b> pcs, V-neck <b>{orderV}</b> pcs.
                </>
              ) : (
                <>Single product mode. The entire order goes into one table.</>
              )}
            </div>
          </div>
        </header>

        <div className={`grid gap-6 ${twoVariants ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
          <Section
            title={twoVariants ? "Variant: Boat neck" : "Product"}
            rows={boat}
            setRows={setBoat}
            alloc={boatAlloc}
            orderQty={orderBoat}
            totalAvail={totalAvailBoat}
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
              updateRowFunc={updateRow}
              addRowFunc={addRow}
              removeRowFunc={removeRow}
            />
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
              <div className="text-2xl font-bold">
                {sum(boatAlloc)} / {sum(vAlloc)} pcs
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="text-gray-600">Integrity check</div>
              <div
                className={`text-2xl font-bold ${
                  sum(boatAlloc) + sum(vAlloc) === totalOrder ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {sum(boatAlloc) + sum(vAlloc)} / {totalOrder}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button className="px-4 py-2 rounded-xl border" onClick={() => exportXLSX(exportParams)}>
              Export XLSX
            </button>
            <button className="px-4 py-2 rounded-xl border" onClick={() => exportCSV(exportParams)}>
              Export CSV
            </button>

            <div className="ml-auto flex items-center gap-2">
              <input
                className="border rounded-lg px-2 py-1"
                placeholder="Preset name"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
              />
              <button className="px-3 py-2 rounded-xl border" onClick={handleSavePreset}>
                Save preset
              </button>
              <select className="border rounded-lg px-2 py-2" value={selectedPreset} onChange={(event) => handleLoadPreset(event.target.value)}>
                <option value="">- load preset -</option>
                {presets.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {selectedPreset && (
                <button className="px-3 py-2 rounded-xl border text-red-600" onClick={() => handleDeletePreset(selectedPreset)}>
                  Delete preset
                </button>
              )}
            </div>
          </div>

          <p className="mt-3 text-gray-600 text-sm">
            Algorithm: target final stock = proportion x (available + order). Per-size order = max(0, target - available), then scale and
            round via largest remainders to hit the exact total.
          </p>
        </div>

        <footer className="text-xs text-gray-500">
          Tip: Sales and Available inputs keep raw text while typing; parsing happens in calculations.
        </footer>
      </div>
    </div>
  );
}
