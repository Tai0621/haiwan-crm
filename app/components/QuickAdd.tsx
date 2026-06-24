"use client";

import { useState } from "react";
import { createLead, createHold, createInquiry } from "@/app/actions/tasks";

type Panel = "lead" | "hold" | "inquiry" | null;

const inputCls =
  "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none";
const labelCls = "block text-xs font-medium text-slate-500 mb-1";

export default function QuickAdd() {
  const [open, setOpen] = useState<Panel>(null);

  function toggle(p: Panel) {
    setOpen((cur) => (cur === p ? null : p));
  }

  // After a successful submit the action revalidates "/" and the panel's form is
  // unmounted on re-render; we also close it optimistically on submit.
  const close = () => setOpen(null);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-medium text-slate-700">Quick add:</span>
        <TabButton active={open === "lead"} onClick={() => toggle("lead")} label="Lead" />
        <TabButton active={open === "hold"} onClick={() => toggle("hold")} label="24h hold" />
        <TabButton active={open === "inquiry"} onClick={() => toggle("inquiry")} label="Inquiry" />
      </div>

      {open === "lead" && (
        <form action={createLead} onSubmit={close} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Customer name">
            <input name="name" className={inputCls} placeholder="Optional" />
          </Field>
          <Field label="Phone *">
            <input name="phone" required className={inputCls} placeholder="012-345 6789" />
          </Field>
          <Field label="Item they asked about">
            <input name="item" className={inputCls} placeholder="e.g. Royal Canin Kitten 2kg" />
          </Field>
          <Field label="Store">
            <StoreSelect />
          </Field>
          <Field label="Pet notes" full>
            <input name="petNotes" className={inputCls} placeholder="Optional — breed, age, etc." />
          </Field>
          <Submit label="Create lead (due in 24h)" />
        </form>
      )}

      {open === "hold" && (
        <form action={createHold} onSubmit={close} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Item being held *">
            <input name="item" required className={inputCls} placeholder="e.g. Ziwi Peak Lamb 1kg" />
          </Field>
          <Field label="Store">
            <StoreSelect />
          </Field>
          <Field label="Customer name">
            <input name="name" className={inputCls} placeholder="Optional" />
          </Field>
          <Field label="Phone *">
            <input name="phone" required className={inputCls} placeholder="012-345 6789" />
          </Field>
          <Submit label="Hold for 24 hours" />
        </form>
      )}

      {open === "inquiry" && (
        <form action={createInquiry} onSubmit={close} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Channel">
            <select name="channel" className={inputCls} defaultValue="WHATSAPP">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WEBSITE">Website</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
          </Field>
          <Field label="Phone *">
            <input name="phone" required className={inputCls} placeholder="012-345 6789" />
          </Field>
          <Field label="Customer name">
            <input name="name" className={inputCls} placeholder="Optional" />
          </Field>
          <Field label="What they asked">
            <input name="note" className={inputCls} placeholder="Optional" />
          </Field>
          <Submit label="Log inquiry (reply within 24h)" />
        </form>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      + {label}
    </button>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function StoreSelect() {
  return (
    <select name="store" className={inputCls} defaultValue="NONE">
      <option value="NONE">No preference</option>
      <option value="KL">KL</option>
      <option value="PJ">PJ</option>
    </select>
  );
}

function Submit({ label }: { label: string }) {
  return (
    <div className="sm:col-span-2">
      <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        {label}
      </button>
    </div>
  );
}
