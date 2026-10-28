"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { money } from "@/lib/utils";

export type ItemDraft = {
  description: string;
  category: string;
  quantity: number | string;
  unit: string;
  unitPrice: number | string;
};

const BLANK: ItemDraft = { description: "", category: "LABOR", quantity: 1, unit: "ea", unitPrice: 0 };

export function EstimateItemsEditor({ defaultItems, discount = 0, taxRate = 0 }: { defaultItems?: ItemDraft[]; discount?: number | string; taxRate?: number | string }) {
  const [items, setItems] = useState<ItemDraft[]>(
    defaultItems?.length ? defaultItems : [{ ...BLANK }],
  );
  const [disc, setDisc] = useState(String(discount ?? 0));
  const [tax, setTax] = useState(String(taxRate ?? 0));

  const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(disc) || 0));
  const taxAmount = taxable * ((Number(tax) || 0) / 100);
  const total = taxable + taxAmount;

  function update(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  const payload = items
    .map((i) => ({
      description: i.description,
      category: i.category,
      quantity: Number(i.quantity) || 0,
      unit: i.unit,
      unitPrice: Number(i.unitPrice) || 0,
    }))
    .filter((i) => i.description && i.quantity > 0);

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(payload)} />

      <div className="overflow-hidden rounded-lg border border-line">
        <div className="hidden grid-cols-[1fr_84px_68px_96px_76px_28px] gap-2 border-b border-line bg-panel2 px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.08em] text-muted sm:grid">
          <span>Description</span><span>Qty</span><span>Unit</span><span>Unit price</span><span className="text-right">Amount</span><span />
        </div>
        <div className="divide-y divide-line">
          {items.map((item, index) => (
            <div key={index} className="grid grid-cols-2 gap-2 px-3 py-2 sm:grid-cols-[1fr_84px_68px_96px_76px_28px] sm:items-center">
              <input
                className="input input-sm col-span-2 sm:col-span-1"
                placeholder="Description of work or material"
                value={item.description}
                onChange={(e) => update(index, { description: e.target.value })}
                aria-label={`Line ${index + 1} description`}
              />
              <input
                className="input input-sm"
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) => update(index, { quantity: e.target.value })}
                aria-label={`Line ${index + 1} quantity`}
              />
              <input
                className="input input-sm"
                value={item.unit}
                onChange={(e) => update(index, { unit: e.target.value })}
                aria-label={`Line ${index + 1} unit`}
              />
              <input
                className="input input-sm"
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(e) => update(index, { unitPrice: e.target.value })}
                aria-label={`Line ${index + 1} unit price`}
              />
              <span className="mono text-right text-[11.5px] font-semibold text-ink">
                {money((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
              </span>
              <button
                type="button"
                className="justify-self-end text-muted hover:text-red-600"
                onClick={() => setItems((prev) => (prev.length === 1 ? [{ ...BLANK }] : prev.filter((_, i) => i !== index)))}
                aria-label={`Remove line ${index + 1}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-line bg-panel2 px-3 py-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems((prev) => [...prev, { ...BLANK }])}>
            <Plus size={13} /> Add line item
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
        <div className="field w-full sm:w-[130px]">
          <label className="label" htmlFor="discount">Discount ($)</label>
          <input id="discount" name="discount" className="input input-sm" inputMode="decimal" value={disc} onChange={(e) => setDisc(e.target.value)} />
        </div>
        <div className="field w-full sm:w-[110px]">
          <label className="label" htmlFor="taxRate">Tax rate (%)</label>
          <input id="taxRate" name="taxRate" className="input input-sm" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
        </div>
        <div className="rounded-lg border border-line bg-panel2 px-3 py-2 text-right">
          <div className="text-[9.5px] uppercase tracking-[0.08em] text-muted">Subtotal {money(subtotal)}</div>
          <div className="text-[9.5px] uppercase tracking-[0.08em] text-muted">Tax {money(taxAmount)}</div>
          <div className="mt-0.5 text-[15px] font-[750] tracking-[-0.03em] text-ink">{money(total)}</div>
        </div>
      </div>
    </div>
  );
}
