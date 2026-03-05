'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

// 1. Define the interface clearly
interface PropertyModalProps {
  onClose: () => void;
  onSubmit: (payload: any) => void;
  submitting: boolean;
}

// 2. Apply the interface to the component
export function PropertyModal({ onClose, onSubmit, submitting }: PropertyModalProps) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    address_line_1: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Ethiopia'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean Payload: Remove keys that are empty strings to satisfy Zod min(1)
    const cleanedPayload = Object.fromEntries(
      Object.entries(form).filter(([_, v]) => v.trim() !== '')
    );
    onSubmit(cleanedPayload);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden">
        <div className="p-8 flex justify-between items-center border-b bg-slate-50/50">
          <h2 className="text-2xl font-black text-indigo-600">New Asset</h2>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <input 
            className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-600" 
            placeholder="Property Name" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
            required 
          />
          
          <textarea 
            className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none focus:border-indigo-600 min-h-[100px]" 
            placeholder="Description (Optional)" 
            value={form.description} 
            onChange={e => setForm({...form, description: e.target.value})} 
          />

          <div className="grid grid-cols-2 gap-4">
            <input className="px-5 py-3 bg-slate-50 border rounded-xl" placeholder="Address" value={form.address_line_1} onChange={e => setForm({...form, address_line_1: e.target.value})} required />
            <input className="px-5 py-3 bg-slate-50 border rounded-xl" placeholder="City" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required />
            <input className="px-5 py-3 bg-slate-50 border rounded-xl" placeholder="State" value={form.state} onChange={e => setForm({...form, state: e.target.value})} required />
            <input className="px-5 py-3 bg-slate-50 border rounded-xl" placeholder="Postal Code" value={form.postal_code} onChange={e => setForm({...form, postal_code: e.target.value})} required />
          </div>
          
          <button 
            type="submit" 
            disabled={submitting} 
            className="w-full bg-indigo-600 text-white font-black py-5 rounded-[20px] shadow-lg shadow-indigo-200 disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {submitting ? 'Creating...' : 'Create Property'}
          </button>
        </form>
      </div>
    </div>
  );
}