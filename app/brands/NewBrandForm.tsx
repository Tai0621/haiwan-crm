"use client";

import { useState } from "react";
import { createBrand } from "./actions";

const input = "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-slate-400 focus:outline-none";
const label = "block text-xs font-medium text-slate-500 mb-1";

export default function NewBrandForm() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        + New brand
      </button>
    );
  }

  return (
    <form action={createBrand} onSubmit={() => setOpen(false)} className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={label}>Brand name *</label>
          <input name="name" required className={input} placeholder="e.g. Ziwi Peak" />
        </div>
        <div>
          <label className={label}>Owner</label>
          <select name="owner" className={input} defaultValue="">
            <option value="">Unassigned</option>
            {["Dini", "Jeany", "Dannie", "Win Nie", "Evi"].map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Supplier type</label>
          <select name="supplierType" className={input} defaultValue="CONSIGNMENT">
            <option value="TRADING">Trading</option>
            <option value="CONSIGNMENT">Consignment</option>
            <option value="INHOUSE">In-house</option>
            <option value="CO_CREATION">Co-creation</option>
          </select>
        </div>
        <div>
          <label className={label}>Status</label>
          <select name="status" className={input} defaultValue="PROSPECT">
            <option value="PROSPECT">Prospect</option>
            <option value="IN_TALKS">In talks</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </div>
        <div>
          <label className={label}>Aesthetic fit</label>
          <select name="aestheticFit" className={input} defaultValue="">
            <option value="">—</option>
            <option value="HIGH">High</option>
            <option value="CONDITIONAL">Conditional</option>
            <option value="VERIFY">Verify</option>
            <option value="SKIP">Skip</option>
          </select>
        </div>
        <div>
          <label className={label}>Country</label>
          <input name="country" className={input} placeholder="e.g. NZ" />
        </div>
        <div>
          <label className={label}>Website</label>
          <input name="website" className={input} placeholder="https://" />
        </div>
        <div>
          <label className={label}>Trial start</label>
          <input name="trialStartDate" type="date" className={input} />
        </div>
        <div>
          <label className={label}>Listing fee (RM)</label>
          <input name="listingFee" type="number" step="0.01" className={input} />
        </div>
        <div>
          <label className={label}>Commission %</label>
          <input name="commissionPct" type="number" step="0.1" className={input} />
        </div>
        <div className="sm:col-span-3">
          <label className={label}>Next step</label>
          <input name="nextStep" className={input} placeholder="e.g. Send trial agreement" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
          Create brand
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
