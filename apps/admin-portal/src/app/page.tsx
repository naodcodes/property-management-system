import Link from 'next/link';
import { Building2, CreditCard, Users } from 'lucide-react';

export default function AdminHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.25),_transparent_50%)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-24 text-center">
          <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200">
            <Building2 className="h-4 w-4" />
            Betoch Platform
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">Betoch</h1>
          <p className="mt-5 max-w-3xl text-lg text-slate-300 sm:text-xl">
            Modern property management for Ethiopian landlords and tenants
          </p>
          <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-indigo-500"
            >
              Property Manager
            </Link>
            <Link
              href="http://localhost:3002"
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-base font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              Tenant Portal
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 inline-flex rounded-lg bg-indigo-600/20 p-3 text-indigo-300">
            <Building2 className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-white">Property Management</h2>
          <p className="mt-2 text-sm text-slate-300">
            Manage buildings, units, and occupancy from a single operational dashboard.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 inline-flex rounded-lg bg-indigo-600/20 p-3 text-indigo-300">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-white">Tenant Management</h2>
          <p className="mt-2 text-sm text-slate-300">
            Keep tenant records, leases, and communication organized and easy to track.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="mb-4 inline-flex rounded-lg bg-indigo-600/20 p-3 text-indigo-300">
            <CreditCard className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-white">Financial Tracking</h2>
          <p className="mt-2 text-sm text-slate-300">
            Monitor invoices, payments, and account health with clear financial visibility.
          </p>
        </article>
      </section>
    </main>
  );
}
