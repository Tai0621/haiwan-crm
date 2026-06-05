import Link from "next/link";
import CustomerForm from "../CustomerForm";

export default function NewCustomerPage() {
  return (
    <div>
      <Link href="/customers" className="text-sm text-slate-500 hover:underline">
        ← Back to customers
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-2 mb-4">New customer</h1>
      <CustomerForm />
    </div>
  );
}
