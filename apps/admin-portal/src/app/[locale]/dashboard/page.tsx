'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  Wrench, 
  DollarSign, 
  ChevronRight, 
  Building2, 
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Sidebar } from '../commonComponents/Sidebar';
import Link from 'next/link';

export default function AdminDashboard() {
  const { apiRequest } = useApi();
  const [properties, setProperties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tickets, setTickets] = useState([]); // Track maintenance tickets
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Fetching all three data streams in parallel
        const [propRes, invRes, maintRes] = await Promise.all([
          apiRequest('/api/properties'),
          apiRequest('/api/invoices'),
          apiRequest('/api/maintenance')
        ]);

        // console.log("DEBUG   Dashboard Data:", {
        //   properties: propRes.data?.length,
        //   invoices: invRes.data?.length,
        //   tickets: maintRes.data?.length
        // });

        setProperties(propRes.data || []);
        setInvoices(invRes.data || []);
        setTickets(maintRes.data || []);
      } catch (err) { 
        console.error("Dashboard Load Error:", err); 
      } finally { 
        setLoading(false); 
      }
    }
    loadData();
  }, [apiRequest]);

  const stats = useMemo(() => {
    const now = new Date();
    
    // 1. LATE PAYMENTS: Filtered from invoices array
    const lateCount = invoices.filter((inv: any) => {
      const isUnpaid = inv.status !== 'PAID';
      const isOverdue = now > new Date(inv.due_date);
      return isUnpaid && isOverdue;
    }).length;

    // 2. OPEN MAINTENANCE: Filtered from real maintenance tickets
    const openMaintenance = tickets.filter((t: any) => t.status === 'OPEN').length;

    // 3. PENDING LEASES: Calculated from property -> unit nesting
    let pendingLeases = 0;
    properties.forEach((p: any) => {
      p.units?.forEach((u: any) => {
        if (u.lease_status === 'pending' || u.lease_status === 'pending_signature') {
          pendingLeases++;
        }
      });
    });

    return { lateCount, pendingLeases, openMaintenance };
  }, [properties, invoices, tickets]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-indigo-600 w-12 h-12" />
        <p className="text-slate-400 font-bold animate-pulse uppercase tracking-widest text-xs">
          Syncing Portfolio...
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-6 md:p-10 space-y-10">
        <header>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard size={16} className="text-indigo-600" />
            <p className="text-indigo-600 font-bold text-xs uppercase tracking-widest">
              Admin Portal
            </p>
          </div>
          <h1 className="text-4xl font-black tracking-tight">Portfolio Overview</h1>
        </header>

        {/* TOP METRICS GRID */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NavStatCard 
            title="Late Payments" 
            value={stats.lateCount} 
            icon={<DollarSign />} 
            color="rose" 
            href="/admin/payments"
            description={stats.lateCount > 0 ? "Urgent collection required" : "All accounts up to date"}
          />

          <NavStatCard 
            title="Lease Tracker" 
            value={stats.pendingLeases} 
            icon={<Clock />} 
            color="amber" 
            href="/admin/leases?status=pending"
            description="Awaiting signatures"
          />

          <NavStatCard 
            title="Maintenance" 
            value={stats.openMaintenance} 
            icon={<Wrench />} 
            color="indigo" 
            href="/admin/maintenance"
            description="Unresolved requests"
          />
        </section>

        {/* PROPERTY LIST SECTION */}
        <section className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-2xl font-black tracking-tight text-slate-800">Your Properties</h2>
            <Link href="/properties" className="text-xs font-black text-indigo-600 uppercase hover:text-indigo-700 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
              Manage All
            </Link>
          </div>
          
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm divide-y divide-slate-100">
            {properties.length > 0 ? (
              properties.map((p: any) => (
                <PropertyRow key={p.id} property={p} />
              ))
            ) : (
              <div className="p-20 text-center">
                <Building2 size={48} className="mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No properties found</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

/* --- Helper Components --- */

function NavStatCard({ title, value, icon, color, href, description }: any) {
  const themes: any = {
    rose: "bg-rose-100 text-rose-600 shadow-rose-100",
    indigo: "bg-indigo-100 text-indigo-600 shadow-indigo-100",
    amber: "bg-amber-100 text-amber-600 shadow-amber-100",
  };

  return (
    <Link href={href} className="group relative bg-white p-8 rounded-[32px] border-2 border-transparent hover:border-slate-900 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-2xl ${themes[color]} shadow-md`}>
          {icon}
        </div>
        <div className="bg-slate-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={16} className="text-slate-900" />
        </div>
      </div>
      
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest leading-none mb-2">{title}</p>
      <h3 className="text-5xl font-black text-slate-900 mb-2">{value}</h3>
      <p className="text-slate-400 text-xs font-medium">{description}</p>
    </Link>
  );
}

function PropertyRow({ property }: any) {
  const total = property.units?.length || 0;
  const occupied = property.units?.filter((u: any) => u.is_occupied).length || 0;
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-7 hover:bg-slate-50 transition-colors group">
      <div className="flex items-center gap-5 mb-4 md:mb-0">
        <div className="w-14 h-14 bg-slate-900 rounded-[20px] flex items-center justify-center text-white shrink-0 shadow-lg shadow-slate-300 group-hover:bg-indigo-600 transition-colors">
          <Building2 size={24} />
        </div>
        <div>
          <h4 className="font-black text-slate-900 text-xl leading-tight">{property.name}</h4>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
            {property.city}, {property.country}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-10 md:gap-16">
        <div className="min-w-[160px]">
          <div className="flex justify-between items-end mb-2 px-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Occupancy</p>
            <p className={`text-sm font-black ${occupancyRate < 70 ? 'text-rose-600' : 'text-indigo-600'}`}>
              {occupancyRate}%
            </p>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
            <div 
              className={`h-full transition-all duration-700 ease-out ${occupancyRate < 70 ? 'bg-rose-500' : 'bg-indigo-600'}`}
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Inventory</p>
          <p className="text-base font-black text-slate-900">{occupied} / {total} Units</p>
        </div>

        <Link 
          href={`/properties/${property.id}`}
          className="bg-white border-2 border-slate-900 text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm active:scale-95"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}