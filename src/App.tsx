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

type BaseTemplate = Preset & {
  description: string;
};

type RowSetter = React.Dispatch<React.SetStateAction<Row[]>>;
type AppView = "start" | "allocator" | "reorder";
type IconProps = { className?: string };

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

type NavItemProps = {
  icon: React.ComponentType<IconProps>;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
};

const STORAGE_KEY = "size_order_allocator_presets_v1";
const inputClass =
  "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100";
const buttonClass =
  "h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-500 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-100";

const baseTemplates: BaseTemplate[] = [
  {
    name: "Sukienki / rozmiary XS-XXL",
    description: "Jedna tabela dla sukienek, bluz, swetrów i innych produktów liczonych po standardowych rozmiarach.",
    totalOrder: 500,
    splitBoat: 1,
    twoVariants: false,
    boat: [
      { size: "XS", sales: "18", proportion: 0, available: "8" },
      { size: "S", sales: "54", proportion: 0, available: "18" },
      { size: "M", sales: "72", proportion: 0, available: "20" },
      { size: "L", sales: "48", proportion: 0, available: "14" },
      { size: "XL", sales: "22", proportion: 0, available: "7" },
      { size: "XXL", sales: "10", proportion: 0, available: "3" },
    ],
    vneck: [],
  },
  {
    name: "Spodnie / rozmiary 34-44",
    description: "Układ dla spodni, jeansów i dołów, gdzie rozmiarówka jest numeryczna.",
    totalOrder: 400,
    splitBoat: 1,
    twoVariants: false,
    boat: [
      { size: "34", sales: "12", proportion: 0, available: "4" },
      { size: "36", sales: "38", proportion: 0, available: "11" },
      { size: "38", sales: "64", proportion: 0, available: "17" },
      { size: "40", sales: "58", proportion: 0, available: "13" },
      { size: "42", sales: "31", proportion: 0, available: "8" },
      { size: "44", sales: "14", proportion: 0, available: "3" },
    ],
    vneck: [],
  },
  {
    name: "T-shirty / dwa warianty",
    description: "Dwie tabele, np. dwa kroje, dwa dekolty albo dwie wersje produktu.",
    totalOrder: 800,
    splitBoat: 0.45,
    twoVariants: true,
    boat: [
      { size: "XS", sales: "10", proportion: 0, available: "6" },
      { size: "S", sales: "44", proportion: 0, available: "22" },
      { size: "M", sales: "68", proportion: 0, available: "25" },
      { size: "L", sales: "52", proportion: 0, available: "16" },
      { size: "XL", sales: "24", proportion: 0, available: "8" },
      { size: "XXL", sales: "12", proportion: 0, available: "2" },
    ],
    vneck: [
      { size: "XS", sales: "8", proportion: 0, available: "5" },
      { size: "S", sales: "36", proportion: 0, available: "18" },
      { size: "M", sales: "74", proportion: 0, available: "24" },
      { size: "L", sales: "61", proportion: 0, available: "14" },
      { size: "XL", sales: "28", proportion: 0, available: "7" },
      { size: "XXL", sales: "16", proportion: 0, available: "1" },
    ],
  },
  {
    name: "Buty / rozmiary 36-41",
    description: "Szybki start dla produktów liczonych po rozmiarach obuwia.",
    totalOrder: 300,
    splitBoat: 1,
    twoVariants: false,
    boat: [
      { size: "36", sales: "9", proportion: 0, available: "3" },
      { size: "37", sales: "24", proportion: 0, available: "7" },
      { size: "38", sales: "42", proportion: 0, available: "12" },
      { size: "39", sales: "38", proportion: 0, available: "10" },
      { size: "40", sales: "21", proportion: 0, available: "5" },
      { size: "41", sales: "11", proportion: 0, available: "2" },
    ],
    vneck: [],
  },
];

function cloneRows(rows: Row[]) {
  return rows.map((row) => ({ ...row }));
}

function HomeIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m3 10 9-7 9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

function AllocatorIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
      <path d="M8 5v14" />
      <path d="M16 5v14" />
    </svg>
  );
}

function ReorderIcon({ className = "" }: IconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M6 7h12" />
      <path d="M6 12h12" />
      <path d="M6 17h7" />
      <path d="M4 4h16v16H4z" />
    </svg>
  );
}

function MetricCard({ label, value, accent }: MetricCardProps) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${accent}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function NavItem({ icon: Icon, label, description, active, onClick }: NavItemProps) {
  return (
    <button
      className={`group flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-100 ${
        active
          ? "border-cyan-200 bg-cyan-50 text-cyan-950"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-950"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={`mt-0.5 rounded-md p-1.5 ${active ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500 group-hover:text-slate-800"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs leading-4 opacity-75">{description}</span>
      </span>
    </button>
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
  const [activeView, setActiveView] = useState<AppView>("start");
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
    document.title = "Production Planner";
  }, []);

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

  function applyTemplate(template: BaseTemplate) {
    setTwoVariants(template.twoVariants);
    setTotalOrder(template.totalOrder);
    setSplitBoat(template.splitBoat);
    setBoat(cloneRows(template.boat));
    setVneck(cloneRows(template.vneck));
    setPresetName(template.name);
    setSelectedPreset("");
    setActiveView("allocator");
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
    setBoat(cloneRows(preset.boat));
    setVneck(cloneRows(preset.vneck));
    setActiveView("allocator");
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

  const startView = (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Start</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Dashboard produkcyjny</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Tu docelowo zbierzemy najważniejsze informacje: produkty do domówienia, ostatnie alokacje, alerty braków rozmiarów i szybkie akcje dla produkcji.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button className={buttonClass} onClick={() => setActiveView("allocator")} type="button">
            Otwórz alokator rozmiarów
          </button>
          <button className={buttonClass} onClick={() => setActiveView("reorder")} type="button">
            Produkty do domówienia
          </button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Moduły aktywne" value="1" accent="border-l-4 border-l-cyan-500" />
        <MetricCard label="Szablony bazowe" value={`${baseTemplates.length}`} accent="border-l-4 border-l-amber-500" />
        <MetricCard label="Zapisane presety" value={`${presets.length}`} accent="border-l-4 border-l-emerald-500" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Plan rozwoju</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            "Import CSV/XLSX ze sprzedażą i stockiem",
            "Produkty do domówienia bez dostępu do Shopify API",
            "Eksport zamówienia gotowego dla produkcji",
            "Ręczne blokady i korekty rozmiarów",
            "Historia poprzednich alokacji",
            "Alerty, gdy rozmiar był wyprzedany i sprzedaż jest zaniżona",
          ].map((item) => (
            <div key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const allocatorView = (
    <div className="space-y-5">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Alokator zamówień rozmiarów</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Rozdział produkcji po rozmiarach</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Rozdziel zamówienie między warianty i rozmiary na podstawie sprzedaży historycznej, aktualnego stocku i udziału wariantów.
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
                Produkt ma <b>dwa warianty</b>
              </span>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Łączne zamówienie</span>
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
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Udział wariantu 1</span>
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
                  Wariant 1 <b>{toPercent(splitBoat)}</b> / Wariant 2 <b>{toPercent(splitV)}</b>. Zamówienia: <b>{orderBoat}</b> pcs /{" "}
                  <b>{orderV}</b> pcs.
                </>
              ) : (
                <>Tryb jednego produktu. Całe zamówienie trafia do pierwszej tabeli.</>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Bazowe szablony</p>
            <h2 className="text-lg font-semibold text-slate-950">Start z gotowej rozmiarówki</h2>
            <p className="mt-1 text-sm text-slate-600">Wybierz typ produktu, a potem podmień sprzedaż i dostępność na aktualne dane.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {baseTemplates.map((template) => (
            <button
              key={template.name}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-cyan-400 hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              onClick={() => applyTemplate(template)}
              type="button"
            >
              <span className="text-sm font-semibold text-slate-950">{template.name}</span>
              <span className="mt-2 block text-xs leading-5 text-slate-600">{template.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className={`grid gap-5 ${twoVariants ? "xl:grid-cols-2" : "xl:grid-cols-1"}`}>
        <Section
          title={twoVariants ? "Wariant 1" : "Produkt"}
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
            title="Wariant 2"
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
        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Instrukcja dla produkcji</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Jak przygotować dane do zamówienia</h2>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
              <li>
                <b>Sprzedaż:</b> wpisz sprzedaż z okresu, w którym produkt realnie był na stocku. Najlepiej użyć ostatnich 30 dni dostępności dla
                każdego rozmiaru. Jeśli rozmiar był wyprzedany przez część okresu, nie licz dni bez stocku do analizy.
              </li>
              <li>
                <b>Dostępne:</b> wpisz aktualny stan magazynowy przed domówieniem. To ma być stan dostępny do sprzedaży, nie suma z rezerwacjami albo
                towarem w drodze.
              </li>
              <li>
                <b>Łączne zamówienie:</b> wpisz całkowitą liczbę sztuk, którą chcesz zlecić do produkcji. Aplikacja rozdzieli ją po rozmiarach tak,
                żeby po dostawie stock był bliżej proporcji sprzedaży.
              </li>
              <li>
                <b>Dwa warianty:</b> włącz checkbox, gdy produkt ma dwie wersje, np. dwa kroje, dekolty albo kolory produkowane w jednej partii.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <h3 className="font-semibold">Dobra praktyka</h3>
            <p className="mt-2">
              Dla nowego produktu użyj podobnego produktu jako benchmarku: podobny krój, materiał, sezon i cena. Dla bestsellerów patrz na dłuższy
              okres, ale tylko wtedy, gdy rozmiary nie były długo wyprzedane.
            </p>
            <p className="mt-2">
              Jeśli jakiś rozmiar sprzedał mało sztuk tylko dlatego, że szybko zniknął ze stocku, podnieś jego sprzedaż ręcznie albo użyj okresu, w
              którym był dostępny. Inaczej algorytm może go zaniżyć.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Podsumowanie</h2>
            <p className="mt-1 text-sm text-slate-600">Sprawdź sumy, wyeksportuj pliki i zapisz własne presety.</p>
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
          <MetricCard label="Łączne zamówienie" value={`${totalOrder} pcs`} accent="border-l-4 border-l-cyan-500" />
          <MetricCard label="Zamówienia 1 / 2" value={`${sum(boatAlloc)} / ${sum(vAlloc)} pcs`} accent="border-l-4 border-l-amber-500" />
          <MetricCard
            label="Kontrola sumy"
            value={`${totalAllocated} / ${totalOrder}`}
            accent={`border-l-4 ${totalAllocated === totalOrder ? "border-l-emerald-500" : "border-l-rose-500"}`}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 lg:flex-row lg:items-center">
          <input
            className={`${inputClass} w-full lg:w-64`}
            placeholder="Nazwa presetu"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button className={buttonClass} onClick={handleSavePreset} type="button">
            Zapisz preset
          </button>
          <select className={`${inputClass} w-full lg:w-64`} value={selectedPreset} onChange={(event) => handleLoadPreset(event.target.value)}>
            <option value="">- wczytaj preset -</option>
            {presets.map((preset) => (
              <option key={preset.name} value={preset.name}>
                {preset.name}
              </option>
            ))}
          </select>
          {selectedPreset && (
            <button className={`${buttonClass} text-rose-600 hover:border-rose-400 hover:text-rose-700`} onClick={() => handleDeletePreset(selectedPreset)} type="button">
              Usuń preset
            </button>
          )}
        </div>

        <p className="mt-3 text-sm text-slate-500">
          Algorytm: docelowy stock = proporcja x (dostępne + zamówienie). Zamówienie per rozmiar = max(0, cel - dostępne), potem skalowanie i
          zaokrąglenie tak, żeby trafić dokładnie w sumę zamówienia.
        </p>
      </section>
    </div>
  );

  const reorderView = (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Produkty do domówienia</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">Lista produktów do analizy</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
        To będzie miejsce na import plików z Shopify albo raportów CSV/XLSX. Na start możemy zrobić bezpieczny import lokalny w przeglądarce, bez
        dawania aplikacji dostępu do Shopify API.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricCard label="Źródło danych" value="CSV/XLSX" accent="border-l-4 border-l-cyan-500" />
        <MetricCard label="Dostęp do Shopify" value="Brak" accent="border-l-4 border-l-emerald-500" />
        <MetricCard label="Status" value="Plan" accent="border-l-4 border-l-amber-500" />
      </div>
    </section>
  );

  const currentView = activeView === "start" ? startView : activeView === "allocator" ? allocatorView : reorderView;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <aside className="border-b border-slate-200 bg-slate-950 p-4 text-white lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400 font-bold text-slate-950">PP</div>
          <div>
            <div className="text-sm font-semibold">Production Planner</div>
            <div className="text-xs text-slate-400">Modułowa aplikacja produkcyjna</div>
          </div>
        </div>

        <nav className="mt-4 grid gap-2">
          <NavItem
            active={activeView === "start"}
            description="Przyszły dashboard i szybkie akcje"
            icon={HomeIcon}
            label="Start"
            onClick={() => setActiveView("start")}
          />
          <NavItem
            active={activeView === "allocator"}
            description="Rozdział zamówienia po rozmiarach"
            icon={AllocatorIcon}
            label="Alokator zamówień rozmiarów"
            onClick={() => setActiveView("allocator")}
          />
          <NavItem
            active={activeView === "reorder"}
            description="Import raportów i lista braków"
            icon={ReorderIcon}
            label="Produkty do domówienia"
            onClick={() => setActiveView("reorder")}
          />
        </nav>

        <div className="mt-4 rounded-lg border border-slate-800 bg-white/5 p-3 text-xs leading-5 text-slate-300">
          Kolejne moduły można dodawać bez przebudowy całego UI. Sidebar zostaje szkieletem aplikacji.
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">{currentView}</div>
      </main>
    </div>
  );
}
