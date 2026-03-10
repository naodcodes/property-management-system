'use client';

import { useState, useEffect, useMemo } from 'react';
import { Loader2, AlertCircle, Home, FileWarning, ArrowRight, Building2, User, Ruler, Bed, Bath } from 'lucide-react';
import { useApi } from './hooks/useApi';
import { Sidebar } from './components/Sidebar';

export default function AdminDashboard() {
  const { apiRequest } = useApi();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const json = await apiRequest('/api/properties');
        setProperties(json.data || []);
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    }
    loadData();
  }, [apiRequest]);

  const filteredData = useMemo(() => {
    const late: any[] = [];
    const vacant: any[] = [];
    const inactiveLeases: any[] = [];
  
    properties.forEach((p: any) => {
      p.units?.forEach((u: any) => {
        // Build unit context based on your UnitPayload & OnboardPayload
        const unitContext = { 
          ...u, 
          propertyName: p.name,
          propertyId: p.id,
          // Mapping directly to your Payload fields
          rent: u.monthly_rent || 0,
          code: u.unit_code || 'N/A',
          isOccupied: u.is_occupied // This is your boolean
        };
  
        // 1. LATE PAYMENTS
        // Based on your requirements, checking for 'overdue' or 'late' payment status
        if (u.is_occupied && u.payment_status === 'late') {
          late.push(unitContext);
        }
  
        // 2. NOT OCCUPIED (Direct check of your is_occupied boolean)
        if (u.is_occupied === false) {
          vacant.push(unitContext);
        }
  
        // 3. WAITING / INACTIVE
        // Logic for units where onboardTenant was called but status isn't active
        if (u.lease_status === 'pending_signature' || u.lease_status === 'pending') {
          inactiveLeases.push(unitContext);
        }
      });
    });
  
    return { late, vacant, inactiveLeases };
  }, [properties]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />
      <main className="flex-1 lg:ml-64 p-8 space-y-12">
        <header>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic">Portfolio Manager</h1>
        </header>

        <StatusSection title="Late Payments" units={filteredData.late} icon={<AlertCircle size={20} />} variant="rose" badge="Urgent Actions" />
        <StatusSection title="Not Occupied" units={filteredData.vacant} icon={<Home size={20} />} variant="indigo" badge="Vacant" />
        <StatusSection title="Lease Tracker" units={filteredData.inactiveLeases} icon={<FileWarning size={20} />} variant="amber" badge="Compliance" />

        <section className="pt-10 border-t border-slate-200">
           <h2 className="text-2xl font-black text-slate-900 mb-6">Manage Properties</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {properties.map((p: any) => (
              <PropertySummaryCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusSection({ title, units, icon, variant, badge }: any) {
  const styles: any = {
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100', accent: 'bg-rose-600' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-100', accent: 'bg-indigo-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', accent: 'bg-amber-600' },
  };
  const style = styles[variant];

  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className={`${style.accent} text-white p-2 rounded-lg`}>{icon}</div>
        <h2 className="text-2xl font-black text-slate-900">{title}</h2>
        <span className={`${style.bg} ${style.text} px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>
          {units.length} {badge}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {units.length > 0 ? units.map((u: any) => (
          <div key={u.id} className={`bg-white p-6 rounded-[32px] border-2 ${style.border} hover:shadow-xl transition-all group`}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{u.propertyName}</p>
                <h4 className="text-2xl font-black text-slate-900 leading-none">{u.code}</h4>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-slate-900">${u.rent}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase">Rent</p>
              </div>
            </div>

            {/* DETAIL SECTION USING YOUR UNITPAYLOAD INFO */}
            <div className="grid grid-cols-3 gap-2 mb-6 border-y border-slate-50 py-4">
              <div className="text-center border-r border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase">Floor</p>
                <p className="text-sm font-bold text-slate-700">{u.floor ?? 'G'}</p>
              </div>
              <div className="text-center border-r border-slate-100">
                <p className="text-[9px] font-black text-slate-400 uppercase">Beds</p>
                <p className="text-sm font-bold text-slate-700">{u.bedrooms || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase">Baths</p>
                <p className="text-sm font-bold text-slate-700">{u.bathrooms || 0}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <User size={14} />
              </div>
              <div className="overflow-hidden">
                <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">Status</p>
                <p className="text-xs font-bold text-slate-700 truncate">
                  {u.isOccupied ? 'Occupied' : 'Vacant / Available'}
                </p>
              </div>
            </div>

            <button className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest ${style.bg} ${style.text} hover:opacity-80 transition-all`}>
              Manage Unit
            </button>
          </div>
        )) : (
          <div className="col-span-full py-10 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No entries found</p>
          </div>
        )}
      </div>
    </section>
  );
}

function PropertySummaryCard({ property }: any) {
  const occupiedCount = property.units?.filter((u: any) => u.is_occupied).length || 0;
  const totalUnits = property.units?.length || 0;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-[32px] p-7 flex items-center justify-between">
      <div className="flex items-center gap-5">
        <div className="bg-slate-900 p-4 rounded-2xl text-white shadow-lg shadow-slate-200"><Building2 size={24} /></div>
        <div>
          <h3 className="text-xl font-black text-slate-900 leading-tight">{property.name}</h3>
          <p className="text-slate-400 text-[10px] font-black uppercase mt-1">
             {property.city}, {property.country}
          </p>
        </div>
      </div>
      <div className="flex gap-10 text-right">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Units</p>
          <p className="text-xl font-black text-slate-900">{totalUnits}</p>
        </div>
        <div className="border-l border-slate-100 pl-10">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Occupancy</p>
          <p className="text-xl font-black text-indigo-600">{occupancyRate}%</p>
        </div>
      </div>
    </div>
  );
}