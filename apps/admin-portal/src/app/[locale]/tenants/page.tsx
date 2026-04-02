import { Sidebar } from '../dashboard/components/Sidebar';

export default function TenantsPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-8">
        <header className="mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Tenants</h1>
          <p className="text-slate-500 text-sm font-medium">Coming soon</p>
        </header>
      </main>
    </div>
  );
}
