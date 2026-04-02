'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Building2, 
  MapPin, 
  Users, 
  Wrench, 
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Sidebar } from '../commonComponents/Sidebar';
import Link from 'next/link';

export default function PropertiesPage() {
  const { apiRequest } = useApi();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchProperties() {
      try {
        const res = await apiRequest('/api/properties');
        setProperties(res.data || []);
      } catch (err) {
        console.error("Failed to load properties:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProperties();
  }, [apiRequest]);

  // Handle Search Filtering
  const filteredProperties = useMemo(() => {
    return properties.filter((p: any) => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [properties, searchQuery]);

  if (loading) return <div className="p-20 text-center animate-pulse">Loading Portfolio...</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-6 md:p-10">
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Your Portfolio</h1>
            <p className="text-slate-500 font-medium">{properties.length} Total Properties</p>
          </div>
          
          <button className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95">
            <Plus size={20} />
            Add Property
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search by name, city, or address..."
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-slate-200 px-5 py-3 rounded-2xl font-bold text-slate-600 hover:bg-slate-50">
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* PROPERTIES GRID */}
        {filteredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProperties.map((property: any) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[32px] border-2 border-dashed border-slate-200 p-20 text-center">
             <Building2 size={48} className="mx-auto text-slate-200 mb-4" />
             <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">No properties match your search</p>
          </div>
        )}
      </main>
    </div>
  );
}

function PropertyCard({ property }: any) {
  const totalUnits = property.units?.length || 0;
  const occupiedUnits = property.units?.filter((u: any) => u.is_occupied).length || 0;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 10) * 10 : 0; // Simplified for UI
  const openTickets = property.units?.filter((u: any) => u.maintenance_status === 'open').length || 0;

  return (
    <Link href={`/properties/${property.id}`} className="group bg-white rounded-[32px] border border-slate-200 p-6 hover:shadow-2xl hover:border-slate-900 transition-all duration-300">
      <div className="flex justify-between items-start mb-6">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          <Building2 size={24} />
        </div>
        <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-400">
          <MapPin size={12} />
          {property.city}
        </div>
      </div>

      <h3 className="text-xl font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{property.name}</h3>
      <p className="text-slate-400 text-sm font-medium mb-6 truncate">{property.address_line_1}</p>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Occupancy</span>
          </div>
          <p className="text-lg font-black text-slate-900">{occupiedUnits}/{totalUnits}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Wrench size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Tickets</span>
          </div>
          <p className={`text-lg font-black ${openTickets > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {openTickets}
          </p>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="space-y-2">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
          <span>Status</span>
          <span>{occupancyRate}% Full</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${occupancyRate < 50 ? 'bg-rose-500' : 'bg-indigo-600'}`}
            style={{ width: `${occupancyRate}%` }}
          />
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
        <span className="text-indigo-600 text-xs font-black uppercase tracking-widest">View Details</span>
        <ArrowUpRight size={18} className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
      </div>
    </Link>
  );
}
