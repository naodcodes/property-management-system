'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  ArrowLeft, User, Wrench, X, 
  DollarSign, Home, Info, AlertTriangle 
} from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { Sidebar } from '../../commonComponents/Sidebar';
import Link from 'next/link';

export default function PropertyUnitsPage() {
  const { id } = useParams();
  const { apiRequest } = useApi();
  const [property, setProperty] = useState<any>(null);
  const [selectedUnit, setSelectedUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetails() {
      try {
        const res = await apiRequest(`/api/properties/${id}`);
        setProperty(res.data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    }
    fetchDetails();
  }, [id, apiRequest]);

  if (loading) return <div className="p-20 text-center animate-pulse font-black">SYNCING UNIT DATA...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-6 md:p-10 relative">
        <header className="mb-10">
          <Link href="/properties" className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 mb-4 transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Portfolio</span>
          </Link>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">{property?.name}</h1>
          <p className="text-slate-500 font-medium">Unit Management & Occupancy</p>
        </header>

        {/* UNIT GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {property?.units?.map((unit: any) => {
            const hasTicket = unit.maintenance_status === 'open';
            const isOccupied = unit.is_occupied;

            // Determine Color Scheme
            let bgColor = "bg-white border-slate-200";
            let accentColor = "text-slate-400";
            
            if (hasTicket) {
              bgColor = "bg-amber-50 border-amber-200";
              accentColor = "text-amber-600";
            } else if (isOccupied) {
              bgColor = "bg-emerald-50 border-emerald-200";
              accentColor = "text-emerald-600";
            } else {
              bgColor = "bg-rose-50 border-rose-200";
              accentColor = "text-rose-600";
            }

            return (
              <button 
                key={unit.id} 
                onClick={() => setSelectedUnit(unit)}
                className={`group relative overflow-hidden rounded-[32px] border-2 transition-all hover:shadow-2xl hover:-translate-y-1 ${bgColor}`}
              >
                {/* Unit Image / Placeholder */}
                <div className="h-32 bg-slate-200 relative overflow-hidden">
                  <img 
                    src={unit.image_url || `https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=400`} 
                    alt="Unit"
                    className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all duration-500"
                  />
                  <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white shadow-sm ${accentColor}`}>
                    Unit {unit.unit_number}
                  </div>
                </div>

                <div className="p-5 text-left">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">
                        {isOccupied ? (unit.tenant_name || "Active Tenant") : "Vacant Unit"}
                      </h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {unit.type || 'Standard Suite'} • {unit.sqft || '850'} sqft
                      </p>
                    </div>
                    {hasTicket && <AlertTriangle size={18} className="text-amber-500 animate-bounce" />}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-black/5">
                    <div className="flex items-center gap-1 text-slate-900 font-black">
                      <DollarSign size={14} />
                      <span>{unit.rent_amount?.toLocaleString() || '0'}/mo</span>
                    </div>
                    <div className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${isOccupied ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {isOccupied ? 'Leased' : 'Available'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* SLIDE-OVER PANEL */}
        {selectedUnit && (
          <UnitDetailSheet unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
        )}
      </main>
    </div>
  );
}

function UnitDetailSheet({ unit, onClose }: any) {
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full max-w-lg bg-white shadow-2xl z-[70] p-10 overflow-y-auto animate-in slide-in-from-right duration-300">
        <button onClick={onClose} className="absolute top-10 right-10 text-slate-400 hover:text-slate-900 transition-colors">
          <X size={28} />
        </button>

        <header className="mb-10">
          <span className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest mb-4 inline-block">
            Unit {unit.unit_number}
          </span>
          <h2 className="text-5xl font-black text-slate-900 tracking-tight">
            {unit.is_occupied ? "Resident Profile" : "Vacant Unit"}
          </h2>
        </header>

        <div className="space-y-10">
          {/* FINANCIALS */}
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-6 rounded-[24px]">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Monthly Rent</p>
              <p className="text-2xl font-black text-slate-900">${unit.rent_amount || '0'}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-[24px]">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Security Deposit</p>
              <p className="text-2xl font-black text-slate-900">${unit.security_deposit || '0'}</p>
            </div>
          </section>

          {/* TENANT INFO */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <User size={14} /> Lease Information
            </h3>
            <div className="border border-slate-100 rounded-[32px] p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Tenant</span>
                <span className="font-bold text-slate-900">{unit.tenant_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Lease Status</span>
                <span className="text-indigo-600 font-bold capitalize">{unit.lease_status || 'No Active Lease'}</span>
              </div>
            </div>
          </section>

          {/* MAINTENANCE LOG */}
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              <Wrench size={14} /> Maintenance
            </h3>
            {unit.maintenance_status === 'open' ? (
              <div className="bg-amber-50 border border-amber-100 p-6 rounded-[24px]">
                <p className="font-black text-amber-900">Active Request Found</p>
                <p className="text-sm text-amber-700 mt-1">Check the maintenance tab for full details on this ticket.</p>
              </div>
            ) : (
              <div className="bg-emerald-50 p-6 rounded-[24px] text-emerald-700 font-bold text-sm">
                No active issues reported.
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}