import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import CustomerForm from "../../CustomerForm";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  return (
    <div>
      <Link href={`/customers/${id}`} className="text-sm text-slate-500 hover:underline">
        ← Back to customer
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-2 mb-4">Edit customer</h1>
      <CustomerForm customer={customer} />
    </div>
  );
}
