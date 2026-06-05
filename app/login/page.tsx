import { login } from "./actions";
import Logo from "@/app/components/Logo";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form
        action={login}
        className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-sm space-y-5 shadow-sm"
      >
        <div className="text-center">
          <Logo className="h-6 w-auto text-slate-900 mx-auto" />
          <p className="text-xs font-medium uppercase tracking-widest text-slate-400 mt-2">
            Customer CRM
          </p>
          <p className="text-sm text-slate-500 mt-3">Enter the shared password to continue.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            name="password"
            type="password"
            autoFocus
            required
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">Incorrect password. Try again.</p>}

        <button className="w-full bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-700">
          Sign in
        </button>
      </form>
    </div>
  );
}
