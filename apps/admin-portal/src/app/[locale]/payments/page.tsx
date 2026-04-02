'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, Search, CheckCircle2, Receipt, AlertCircle, Plus, 
  ArrowUpRight, MoreVertical, Clock, CreditCard, X, 
  User, Building2, Hash, Smartphone, Banknote
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { Sidebar } from '../commonComponents/Sidebar';

export default function PaymentManager() {
  const { apiRequest } = useApi();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // State for the Payment Drawer
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await apiRequest('/api/invoices');
        setInvoices(res.data || []);
      } catch (err) {
        console.error("Load Error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, [apiRequest]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    
    setIsSubmitting(true);
    try {
      // Logic to hit your PATCH /api/invoices/:id/pay endpoint
      await apiRequest(`/api/invoices/${selectedInvoice.id}/pay`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PAID', paid_at: new Date() })
      });
      
      // Update local state
      setInvoices(prev => prev.map(inv => 
        inv.id === selectedInvoice.id ? { ...inv, status: 'PAID' } : inv
      ));
      setSelectedInvoice(null);
      alert("Payment Recorded Successfully!");
    } catch (err) {
      console.error("Payment failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv: any) => {
      const isOverdue = new Date(inv.due_date) < new Date() && inv.status !== 'PAID';
      const matchesStatus = filter === 'ALL' || (filter === 'PAID' && inv.status === 'PAID') || (filter === 'PENDING' && inv.status === 'ISSUED' && !isOverdue) || (filter === 'OVERDUE' && isOverdue);
      const search = searchQuery.toLowerCase();
      return matchesStatus && (
        (inv.leases?.units?.properties?.name || "").toLowerCase().includes(search) ||
        (inv.leases?.units?.unit_code || "").toLowerCase().includes(search) ||
        (inv.invoice_number || "").toLowerCase().includes(search)
      );
    });
  }, [invoices, filter, searchQuery]);

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-slate-900 w-12 h-12" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 overflow-x-hidden">
      <Sidebar />
      
      <main className="flex-1 lg:ml-64 p-6 md:p-10 space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={16} className="text-slate-900" />
              <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Property Operations</p>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">Payment Manager</h1>
          </div>
        </header>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Search by property, unit, or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold outline-none focus:border-slate-900 transition-all shadow-sm"
            />
          </div>
          <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-2xl shadow-sm">
            {['ALL', 'PAID', 'PENDING', 'OVERDUE'].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === s ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice List */}
        <section className="space-y-4">
          {filteredInvoices.map((inv) => (
            <div key={inv.id} className="bg-white rounded-[28px] border border-slate-200 p-7 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-xl transition-all group">
              <div className="flex items-center gap-6 flex-1 w-full">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black ${inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {inv.status === 'PAID' ? <CheckCircle2 size={24} /> : <Receipt size={24} />}
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {inv.leases?.units?.properties?.name} • Unit {inv.leases?.units?.unit_code}
                  </p>
                  <h3 className="text-xl font-black text-slate-900">{inv.invoice_number}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter">
                      Due: {new Date(inv.due_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-10 w-full md:w-auto">
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900">{parseFloat(inv.total_amount).toLocaleString()} ETB</p>
                </div>
                {inv.status !== 'PAID' ? (
                  <button 
                    onClick={() => setSelectedInvoice(inv)}
                    className="bg-slate-900 text-white h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
                  >
                    Record Payment <ArrowUpRight size={14} />
                  </button>
                ) : (
                  <span className="text-emerald-600 font-black text-[10px] uppercase tracking-widest">Completed</span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* SLIDE-OVER MODAL / DRAWER */}
        {selectedInvoice && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />
            <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
                <h2 className="text-2xl font-black tracking-tight">Record Payment</h2>
                <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Details Section */}
                <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Property & Unit</p>
                      <p className="font-black text-slate-900">{selectedInvoice.leases?.units?.properties?.name} — {selectedInvoice.leases?.units?.unit_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                      <Hash size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Invoice Number</p>
                      <p className="font-black text-slate-900">{selectedInvoice.invoice_number}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleRecordPayment} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Payment Method</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <button type="button" className="border-2 border-slate-900 p-4 rounded-2xl flex flex-col items-center gap-2 bg-slate-50">
                        <Smartphone size={24} />
                        <span className="text-xs font-black uppercase tracking-widest">Telebirr</span>
                      </button>
                      <button type="button" className="border-2 border-slate-100 p-4 rounded-2xl flex flex-col items-center gap-2 text-slate-400 hover:border-slate-200">
                        <Banknote size={24} />
                        <span className="text-xs font-black uppercase tracking-widest">Cash/Bank</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[32px] p-8 text-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total to Confirm</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-black">{parseFloat(selectedInvoice.total_amount).toLocaleString()}</span>
                      <span className="text-sm font-bold text-slate-400 mb-1.5 uppercase">ETB</span>
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-white text-slate-900 mt-8 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? 'Processing...' : 'Confirm Receipt'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
