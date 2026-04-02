'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Wrench, Search, ChevronRight, ArrowLeft, 
  Hash, Building2, Hammer, CheckCircle2, AlertCircle 
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Sidebar } from '../commonComponents/Sidebar';

export default function MaintenanceAdmin() {
  const { apiRequest } = useApi();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState(''); 
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // State to hold resolved names for the Detail View
  const [details, setDetails] = useState<{ prop: string; unit: string }>({ prop: '', unit: '' });
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    async function fetchTickets() {
      try {
        const res = await apiRequest('/api/maintenance');
        setTickets(res.data || []);
      } catch (err) {
        console.error("Load Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTickets();
  }, [apiRequest]);

  // RESOLVE NAMES WHEN TICKET IS SELECTED
  useEffect(() => {
    async function resolveNames() {
      const active = tickets.find(t => t.id === selectedTicketId);
      if (!active) return;

      setDetailsLoading(true);
      try {
        // Fetching Property and Unit details using the IDs from your logs
        const [pRes, uRes] = await Promise.all([
          apiRequest(`/api/properties/${active.property_id}`),
          apiRequest(`/api/units/${active.unit_id}`)
        ]);

        setDetails({
          prop: pRes.data?.name || 'Property Found',
          unit: uRes.data?.unit_code || 'Unit Found'
        });
      } catch (err) {
        console.error("Resolution failed:", err);
        setDetails({ prop: 'Unknown Property', unit: 'N/A' });
      } finally {
        setDetailsLoading(false);
      }
    }

    if (selectedTicketId) resolveNames();
  }, [selectedTicketId, tickets, apiRequest]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await apiRequest(`/api/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.data) {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }
    } catch (err) { console.error(err); } finally { setUpdating(false); }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter((t: any) => {
      const matchesStatus = filter === 'ALL' || t.status === filter;
      const search = searchQuery.toLowerCase();
      return matchesStatus && (t.title.toLowerCase().includes(search));
    });
  }, [tickets, filter, searchQuery]);

  const activeTicket = tickets.find((t: any) => t.id === selectedTicketId);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-slate-900 w-12 h-12" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-6 md:p-10 space-y-10">
        {activeTicket ? (
          <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => setSelectedTicketId(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-900 font-black text-xs uppercase tracking-widest transition-colors"
            >
              <ArrowLeft size={16} /> Back to Requests
            </button>

            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                   <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                     Ticket #{activeTicket.id.slice(0, 5)}
                   </span>
                   <StatusPill status={activeTicket.status} />
                </div>
                <h1 className="text-5xl font-black tracking-tight text-slate-900">{activeTicket.title}</h1>
              </div>

              <div className="flex gap-3">
                {activeTicket.status === 'OPEN' && (
                  <button 
                    onClick={() => handleStatusUpdate(activeTicket.id, 'IN_PROGRESS')} 
                    disabled={updating}
                    className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {updating ? <Loader2 className="animate-spin" size={16}/> : <Hammer size={16}/>}
                    Start Repair
                  </button>
                )}
                {activeTicket.status === 'IN_PROGRESS' && (
                  <button 
                    onClick={() => handleStatusUpdate(activeTicket.id, 'RESOLVED')} 
                    disabled={updating}
                    className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    {updating ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                    Resolve Issue
                  </button>
                )}
              </div>
            </header>

            <div className="bg-white rounded-[40px] p-12 border border-slate-200 shadow-sm space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-b border-slate-50 pb-12">
                <InfoRow 
                    icon={<Building2 size={24}/>} 
                    label="Property" 
                    value={detailsLoading ? "Fetching..." : details.prop} 
                />
                <InfoRow 
                    icon={<Hash size={24}/>} 
                    label="Unit" 
                    value={detailsLoading ? "..." : details.unit} 
                />
              </div>
              
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Maintenance Request</h4>
                <p className="text-slate-800 leading-relaxed font-medium text-3xl">
                  {activeTicket.description}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* --- LIST VIEW --- */
          <>
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wrench size={16} className="text-slate-900" />
                  <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Maintenance Management</p>
                </div>
                <h1 className="text-4xl font-black tracking-tight">Active Requests</h1>
              </div>
            </header>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[300px] relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-900 transition-colors" size={20} />
                <input 
                  type="text"
                  placeholder="Search by ticket title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm"
                />
              </div>

              <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
                {['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      filter === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <section className="grid grid-cols-1 gap-4">
              {filteredTickets.map((ticket: any) => (
                <div 
                  key={ticket.id} 
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="bg-white rounded-[28px] border border-slate-200 p-7 flex items-center justify-between hover:border-slate-900 hover:shadow-xl cursor-pointer transition-all group"
                >
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket #{ticket.id.slice(0, 5)}</p>
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-slate-900 transition-colors">{ticket.title}</h3>
                    <div className="flex items-center gap-3 mt-1">
                       <StatusPill status={ticket.status} />
                       <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Priority: {ticket.priority}</span>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-slate-900 group-hover:text-white transition-all">
                    <ChevronRight size={20} />
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/* --- UI HELPERS --- */
function StatusPill({ status }: { status: string }) {
  const styles: any = { OPEN: "bg-rose-100 text-rose-600", IN_PROGRESS: "bg-amber-100 text-amber-600", RESOLVED: "bg-emerald-100 text-emerald-600" };
  return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${styles[status]}`}>{status.replace('_', ' ')}</span>;
}

function InfoRow({ icon, label, value }: any) {
  return (
    <div className="space-y-2">
        <div className="flex items-center gap-2 text-slate-400">
            {icon}
            <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
        </div>
        <p className="font-black text-slate-900 text-3xl tracking-tight">{value}</p>
    </div>
  );
}
