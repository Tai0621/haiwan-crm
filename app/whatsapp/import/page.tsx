import WhatsAppImporter from "./WhatsAppImporter";

export const dynamic = "force-dynamic";

export default function WhatsAppImportPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Import WhatsApp chat</h1>
        <p className="text-sm text-slate-500">
          Paste an exported chat to bring messages into the CRM. This is the manual fallback while a
          live connection isn&apos;t set up.
        </p>
      </div>
      <WhatsAppImporter />
    </div>
  );
}
