import ImportTabs from "./ImportTabs";

export default function ImportPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mb-1">Import</h1>
      <p className="text-sm text-slate-500 mb-4">
        Upload CSVs to bring product catalog and StoreHub sales into the CRM. Column names are
        auto-detected; adjust the mapping before importing.
      </p>
      <ImportTabs />
    </div>
  );
}
