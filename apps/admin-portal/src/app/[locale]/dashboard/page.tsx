'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, AlertCircle, Home, FileWarning, ArrowRight, Building2, User, DollarSign, MapPin } from 'lucide-react';

// Hooks & Components
import { useApi } from './hooks/useApi';
import { Sidebar } from './components/Sidebar';

export default function AdminDashboard() {
  const { apiRequest } = useApi();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const json = await apiRequest('/api/properties');
      setProperties(json.data || []);
    } catch (err) {
      console.error("Failed to load properties:", err);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- DATA AGGREGATION ---
  // We extract specific units into lists for the three main sections
  const { lateUnits, vacantUnits, inactiveLeaseUnits } = useMemo(() => {
    const late: any[] = [];
    const vacant: any[] = [];
    const inactive: any[] = [];

    properties.forEach((p: any) => {
      p.units?.forEach((u: any) => {
        const unitWithProp = { ...u, propertyName: p.name };
        
        if (u.payment_status === 'late') {
          late.push(unitWithProp);
        }
        if (!u.is_occupied) {
          vacant.push(unitWithProp);
        }
        if (u.is_occupied && u.lease_status !== 'active') {
          inactive.push(unitWithProp);
        }
      });
    });

    return { lateUnits: late, vacantUnits: vacant, inactiveLeaseUnits: inactive };
  }, [properties]);

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-8 space-y-12">
        <header>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Property Manager</h1>
          <p className="text-slate-500 font-medium">Immediate actions and status updates</p>
        </header>

        {/* --- SECTION 1: LATE PAYMENTS (TOP PRIORITY) --- */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-rose-500 text-white p-2 rounded-lg"><AlertCircle size={20}/></div>
            <h2 className="text-2xl font-black text-slate-900">Late Payments</h2>
            <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-xs font-black">
              {lateUnits.length} URGENT
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {lateUnits.length > 0 ? lateUnits.map((u) => (
              <ActionCard key={u.id} unit={u} type="LATE" />
            )) : (
              <p className="text-slate-400 italic text-sm">No late payments recorded.</p>
            )}
          </div>
        </section>

        {/* --- SECTION 2: NOT OCCUPIED UNITS --- */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-600 text-white p-2 rounded-lg"><Home size={20}/></div>
            <h2 className="text-2xl font-black text-slate-900">Not Occupied</h2>
            <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-xs font-black">
              {vacantUnits.length} AVAILABLE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vacantUnits.length > 0 ? vacantUnits.map((u) => (
              <ActionCard key={u.id} unit={u} type="VACANT" />
            )) : (
              <p className="text-slate-400 italic text-sm">All units are currently occupied.</p>
            )}
          </div>
        </section>

        {/* --- SECTION 3: INACTIVE LEASES --- */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-500 text-white p-2 rounded-lg"><FileWarning size={20}/></div>
            <h2 className="text-2xl font-black text-slate-900">Inactive Leases</h2>
            <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-black">
              {inactiveLeaseUnits.length} ATTENTION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {inactiveLeaseUnits.length > 0 ? inactiveLeaseUnits.map((u) => (
              <ActionCard key={u.id} unit={u} type="INACTIVE" />
            )) : (
              <p className="text-slate-400 italic text-sm">All leases are active and valid.</p>
            )}
          </div>
        </section>

        <hr className="border-slate-200" />

        {/* --- SECTION 4: MANAGE PROPERTIES OVERVIEW --- */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Manage Properties</h2>
              <p className="text-slate-500 text-sm font-medium">Quick metadata for your assets</p>
            </div>
            <button 
              onClick={() => window.location.href = '/properties'}
              className="flex items-center gap-2 text-indigo-600 font-black text-sm uppercase tracking-widest hover:bg-indigo-50 px-4 py-2 rounded-xl transition-all"
            >
              Go to /properties <ArrowRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {properties.map((p: any) => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-[32px] p-6 flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-5">
                  <div className="bg-slate-100 p-4 rounded-2xl text-slate-900">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-900">{p.name}</h3>
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                      <MapPin size={10} /> {p.city}
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Units</p>
                    <p className="font-black text-slate-900">{p.units?.length || 0}</p>
                  </div>
                  <div className="border-l border-slate-100 pl-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Occupancy</p>
                    <p className="font-black text-indigo-600">
                      {p.units?.length ? Math.round((p.units.filter((u:any)=>u.is_occupied).length / p.units.length) * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

// Internal reusable card for the status lists
function ActionCard({ unit, type }: { unit: any, type: 'LATE' | 'VACANT' | 'INACTIVE' }) {
  const themes = {
    LATE: { bg: 'bg-rose-50', border: 'border-rose-100', text: 'text-rose-700', icon: <DollarSign size={14}/> },
    VACANT: { bg: 'bg-indigo-50', border: 'border-indigo-100', text: 'text-indigo-700', icon: <Home size={14}/> },
    INACTIVE: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-700', icon: <User size={14}/> },
  };

  const theme = themes[type];

  return (
    <div className={`p-5 rounded-3xl border-2 ${theme.border} ${theme.bg} flex flex-col justify-between h-32 hover:scale-[1.02] transition-transform cursor-pointer`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
            {unit.propertyName}
          </p>
          <h4 className="text-xl font-black text-slate-900">{unit.unit_code}</h4>
        </div>
        <div className={`${theme.text}`}>
          {theme.icon}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4 border-t border-black/5 pt-3">
        <span className="text-xs font-bold text-slate-600 truncate max-w-[120px]">
          {unit.is_occupied ? unit.tenant_name : 'No Tenant'}
        </span>
        <span className={`text-xs font-black ${theme.text}`}>
          ${unit.monthly_rent}
        </span>
      </div>
    </div>
  );
}