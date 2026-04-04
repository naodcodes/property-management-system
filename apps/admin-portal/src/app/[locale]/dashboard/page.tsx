'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Wrench, DollarSign, ChevronRight, Building2, 
  Clock, LayoutDashboard, TrendingUp, Activity, ArrowUpRight,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Sidebar } from '../commonComponents/Sidebar';
import Link from 'next/link';

export default function AdminDashboard() {
  const { apiRequest } = useApi();
  const [properties, setProperties] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [propRes, invRes, maintRes] = await Promise.all([
          apiRequest('/api/properties'),
          apiRequest('/api/invoices'),
          apiRequest('/api/maintenance')
        ]);
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0); // ✅ full month

    const lateCount = invoices.filter((inv: any) =>
      inv.status !== 'PAID' && now > new Date(inv.due_date)
    ).length;

    let pendingLeases = 0;
    properties.forEach((p: any) => {
      p.units?.forEach((u: any) => {
        if (u.lease_status === 'pending' || u.lease_status === 'pending_signature') {
          pendingLeases++;
        }
      });
    });

    const openMaintenance = tickets.filter((t: any) => t.status === 'OPEN').length;

    const collectedThisMonth = invoices
      .filter((inv: any) => {
        const paidAt = inv.paid_at ? new Date(inv.paid_at) : null;
        return inv.status === 'PAID' && paidAt && paidAt >= startOfMonth;
      })
      .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

    const expectedThisMonth = invoices
      .filter((inv: any) => {
        const due = new Date(inv.due_date);
        return due >= startOfMonth && due <= endOfMonth; // ✅ fixed
      })
      .reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);

    const collectionRate = expectedThisMonth > 0
      ? Math.round((collectedThisMonth / expectedThisMonth) * 100)
      : 0;

    const invoiceEvents = invoices.slice(0, 20).map((inv: any) => ({
      id: `inv-${inv.id}`,
      type: inv.status === 'PAID' ? 'payment' : 'invoice',
      label: inv.status === 'PAID'
        ? `Payment received · $${inv.amount?.toLocaleString()}`
        : `Invoice issued · $${inv.amount?.toLocaleString()}`,
      sub: inv.tenant_name || inv.unit_name || '—',
      date: new Date(inv.paid_at || inv.created_at),
      color: inv.status === 'PAID' ? 'emerald' : 'amber',
    }));

    const ticketEvents = tickets.slice(0, 20).map((t: any) => ({
      id: `tkt-${t.id}`,
      type: 'maintenance',
      label: `Maintenance ${t.status === 'OPEN' ? 'opened' : 'updated'} · ${t.category || 'General'}`,
      sub: t.unit_name || t.property_name || '—',
      date: new Date(t.created_at),
      color: 'indigo',
    }));

    const recentActivity = [...invoiceEvents, ...ticketEvents]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8);

    return { lateCount, pendingLeases, openMaintenance, collectedThisMonth, expectedThisMonth, collectionRate, recentActivity };
  }, [properties, invoices, tickets]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-slate-800" />
          <Loader2 className="animate-spin text-indigo-500 w-16 h-16 absolute inset-0" />
        </div>
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">
          Syncing Portfolio...
        </p>
      </div>
    </div>
  );

  const circumference = 2 * Math.PI * 15.9;
  const progressOffset = circumference - (stats.collectionRate / 100) * circumference;

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex font-sans text-slate-900">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-6 md:p-10 space-y-8">

        {/* HEADER */}
        <header className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-indigo-600 font-bold text-xs uppercase tracking-widest">Admin Portal</p>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Portfolio Overview</h1>
            <p className="text-slate-400 text-sm mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-sm">
            <LayoutDashboard size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Live</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </header>

        {/* STAT CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <NavStatCard
            title="Late Payments" value={stats.lateCount} icon={<DollarSign size={18} />}
            color="rose" href="/payments"
            description={stats.lateCount > 0 ? "Urgent collection required" : "All accounts up to date"}
          />
          <NavStatCard
            title="Lease Tracker" value={stats.pendingLeases} icon={<Clock size={18} />}
            color="amber" href="/admin/leases?status=pending"
            description="Awaiting signatures"
          />
          <NavStatCard
            title="Maintenance" value={stats.openMaintenance} icon={<Wrench size={18} />}
            color="indigo" href="/maintenance"
            description="Unresolved requests"
          />
        </section>

        {/* REVENUE BANNER */}
        <section className="relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200">
          {/* subtle grid texture */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }}
          />
          {/* glow */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-indigo-600 rounded-full opacity-10 blur-3xl" />

          <div className="relative p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-indigo-500/20 p-1.5 rounded-lg">
                  <TrendingUp size={14} className="text-indigo-400" />
                </div>
                <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest">
                  {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-end gap-3 mb-2">
                <h2 className="text-6xl font-black text-white tracking-tight">
                  ${stats.collectedThisMonth.toLocaleString()}
                </h2>
                {stats.collectionRate >= 80
                  ? <CheckCircle2 size={24} className="text-emerald-400 mb-2" />
                  : <AlertCircle size={24} className="text-rose-400 mb-2" />
                }
              </div>
              <p className="text-slate-400 text-sm">
                of <span className="text-slate-300 font-bold">${stats.expectedThisMonth.toLocaleString()}</span> expected this month
              </p>

              {/* Progress bar */}
              <div className="mt-5 w-64">
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${stats.collectionRate >= 80 ? 'bg-indigo-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(stats.collectionRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-10">
              {/* SVG Ring */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={stats.collectionRate >= 80 ? '#6366f1' : '#f43f5e'}
                      strokeWidth="2.5"
                      strokeDasharray={`${circumference}`}
                      strokeDashoffset={`${progressOffset}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-white font-black text-lg leading-none">{stats.collectionRate}%</span>
                    <span className="text-slate-500 text-[9px] uppercase tracking-wider mt-0.5">rate</span>
                  </div>
                </div>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Collection Rate</p>
              </div>

              <Link
                href="/payments"
                className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-900/30"
              >
                View Payments
                <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* BOTTOM GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* PROPERTIES */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight text-slate-800">Your Properties</h2>
              <Link
                href="/properties"
                className="text-xs font-black text-indigo-600 uppercase hover:text-indigo-700 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm hover:shadow-md"
              >
                Manage All →
              </Link>
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm divide-y divide-slate-50">
              {properties.length > 0 ? (
                properties.map((p: any) => <PropertyRow key={p.id} property={p} />)
              ) : (
                <div className="p-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Building2 size={28} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No properties found</p>
                </div>
              )}
            </div>
          </section>

          {/* ACTIVITY */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black tracking-tight text-slate-800">Activity</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-3 py-1.5 rounded-xl">
                Recent
              </span>
            </div>
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-0.5 h-full">
              {stats.recentActivity.length > 0 ? (
                stats.recentActivity.map((event: any, i: number) => (
                  <ActivityItem key={event.id} event={event} index={i} />
                ))
              ) : (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Activity size={20} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No recent activity</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}

/* --- Helper Components --- */

function ActivityItem({ event, index }: any) {
  const dotColors: any = {
    emerald: 'bg-emerald-400',
    amber: 'bg-amber-400',
    indigo: 'bg-indigo-400',
    rose: 'bg-rose-400',
  };

  const timeAgo = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0 group hover:bg-slate-50 -mx-5 px-5 rounded-xl transition-colors">
      <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[event.color]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-700 truncate">{event.label}</p>
        <p className="text-[11px] text-slate-400 truncate">{event.sub}</p>
      </div>
      <span className="text-[10px] text-slate-300 font-bold shrink-0 bg-slate-50 px-1.5 py-0.5 rounded-md">
        {timeAgo(event.date)}
      </span>
    </div>
  );
}

function NavStatCard({ title, value, icon, color, href, description }: any) {
  const themes: any = {
    rose:   { bg: 'bg-rose-50',   icon: 'bg-rose-100 text-rose-500',   border: 'hover:border-rose-200',   num: 'text-rose-600' },
    indigo: { bg: 'bg-indigo-50', icon: 'bg-indigo-100 text-indigo-500', border: 'hover:border-indigo-200', num: 'text-indigo-600' },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-500',  border: 'hover:border-amber-200',  num: 'text-amber-600' },
  };
  const t = themes[color];

  return (
    <Link href={href} className={`group relative bg-white p-7 rounded-3xl border-2 border-slate-100 ${t.border} hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
      <div className="flex justify-between items-start mb-5">
        <div className={`p-3 rounded-2xl ${t.icon}`}>{icon}</div>
        <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors mt-1" />
      </div>
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{title}</p>
      <h3 className={`text-5xl font-black mb-2 ${t.num}`}>{value}</h3>
      <p className="text-slate-400 text-xs">{description}</p>
    </Link>
  );
}

function PropertyRow({ property }: any) {
  const total = property.units?.length || 0;
  const occupied = property.units?.filter((u: any) => u.is_occupied).length || 0;
  const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const isLow = occupancyRate < 70;

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 hover:bg-slate-50/80 transition-colors group">
      <div className="flex items-center gap-4 mb-4 md:mb-0">
        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 group-hover:bg-indigo-600 transition-colors duration-300">
          <Building2 size={20} />
        </div>
        <div>
          <h4 className="font-black text-slate-900 text-base leading-tight">{property.name}</h4>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
            {property.city}, {property.country}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-8 md:gap-12">
        <div className="min-w-[140px]">
          <div className="flex justify-between items-center mb-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Occupancy</p>
            <p className={`text-xs font-black ${isLow ? 'text-rose-500' : 'text-indigo-600'}`}>{occupancyRate}%</p>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${isLow ? 'bg-rose-400' : 'bg-indigo-500'}`}
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Units</p>
          <p className="text-sm font-black text-slate-900">{occupied}<span className="text-slate-300 font-medium"> / {total}</span></p>
        </div>

        <Link
          href={`/properties/${property.id}`}
          className="text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 hover:border-slate-900 hover:text-slate-900 hover:bg-slate-900 hover:text-white transition-all"
        >
          View →
        </Link>
      </div>
    </div>
  );
}