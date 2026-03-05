'use client';

import { useState } from 'react';
import { X, Mail, User, Calendar, Loader2 } from 'lucide-react';

export function TenantInviteModal({ unit, propertyName, onClose, onSubmit, submitting }: any) {
  const [form, setForm] = useState({
    tenant_name: '',
    tenant_email: '',
    lease_start: new Date().toISOString().split('T')[0],
    monthly_rent: unit.monthly_rent,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Invite Tenant</h2>
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest">{unit.unit_code} • {propertyName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><User size={12}/> Full Name</label>
            <input 
              required
              className="w-full px-5 py-3 bg-slate-50 border rounded-xl outline-none focus:border-indigo-600"
              placeholder="John Doe"
              value={form.tenant_name}
              onChange={e => setForm({...form, tenant_name: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><Mail size={12}/> Email Address</label>
            <input 
              required
              type="email"
              className="w-full px-5 py-3 bg-slate-50 border rounded-xl outline-none focus:border-indigo-600"
              placeholder="tenant@example.com"
              value={form.tenant_email}
              onChange={e => setForm({...form, tenant_email: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> Lease Start Date</label>
            <input 
              required
              type="date"
              className="w-full px-5 py-3 bg-slate-50 border rounded-xl outline-none focus:border-indigo-600"
              value={form.lease_start}
              onChange={e => setForm({...form, lease_start: e.target.value})}
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting} 
            className="w-full bg-emerald-600 text-white font-black py-5 rounded-[20px] hover:bg-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Send Invitation Email'}
          </button>
        </form>
      </div>
    </div>
  );
}