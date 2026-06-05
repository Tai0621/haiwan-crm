"use client";

import { useState } from "react";
import { createSubscription } from "./actions";

type CustomerOpt = { id: string; name: string | null; phone: string; pets: { id: string; name: string }[] };
type ProductOpt = { id: string; name: string; isConsumable: boolean };

export default function NewSubscriptionForm({
  customers,
  products,
}: {
  customers: CustomerOpt[];
  products: ProductOpt[];
}) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const pets = selectedCustomer?.pets ?? [];

  // Default next-due = today + 30d
  const defaultDue = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700"
      >
        + New subscription
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await createSubscription(fd);
        setOpen(false);
        setCustomerId("");
      }}
      className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Customer *</label>
          <select
            name="customerId"
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="">— select —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "Unnamed"} ({c.phone})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Pet (optional)</label>
          <select
            name="petId"
            disabled={!selectedCustomer}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white disabled:bg-slate-50"
          >
            <option value="">— none / whole household —</option>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Product *</label>
          <select
            name="productId"
            required
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white"
          >
            <option value="">— select —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isConsumable ? "" : " (non-consumable)"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Interval (days)</label>
          <input
            name="intervalDays"
            type="number"
            min={1}
            defaultValue={30}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Next due date</label>
          <input
            name="nextDueDate"
            type="date"
            defaultValue={defaultDue}
            className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select name="status" defaultValue="ACTIVE" className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm bg-white">
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
          Create subscription
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500 hover:underline"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
