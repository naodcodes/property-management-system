'use client';

import { useState, useEffect } from 'react';
import { X, Bed, Bath, DollarSign, Loader2 } from 'lucide-react';

interface UnitModalProps {
  onClose: () => void;
  onSubmit: (payload: any) => void;
  submitting: boolean;
  propertyName?: string;
  initialData?: any; // If this exists, we are in Edit Mode
}

export function UnitModal({ 
  onClose, 
  onSubmit, 
  submitting, 
  propertyName, 
  initialData 
}: UnitModalProps) {
  
  // Initialize state with initialData (for editing) or defaults (for creating)
  const [form, setForm] = useState({
    unit_code: initialData?.unit_code || '',
    bedrooms: initialData?.bedrooms || 1,
    bathrooms: initialData?.bathrooms || 1,
    monthly_rent: initialData?.monthly_rent || 0,
    is_occupied: initialData?.is_occupied || false,
    // Add optional fields from your schema if needed
    floor: initialData?.floor || 0,
    square_meters: initialData?.square_meters || 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload: any = {
      unit_code: form.unit_code,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      monthly_rent: Number(form.monthly_rent),
      is_occupied: Boolean(form.is_occupied),
    };
  
    // Only include these if they are actually set to something greater than 0
    if (Number(form.floor) > 0) payload.floor = Number(form.floor);
    if (Number(form.square_meters) > 0) payload.square_meters = Number(form.square_meters);
    console.log("1111")
    console.log("PAYLOAD", payload)
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              {initialData ? 'Edit Unit Details' : 'Add New Unit'}
            </h2>
            <p className="text-indigo-600 text-xs font-bold uppercase tracking-widest mt-1">
              {propertyName || 'Property Asset'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-white rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          
          {/* Unit Code */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1">Unit Identifier</label>
            <input 
              className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/5 transition-all" 
              placeholder="e.g. APT-402" 
              value={form.unit_code}
              onChange={(e) => setForm({...form, unit_code: e.target.value})}
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Bedrooms */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1 flex items-center gap-1">
                <Bed size={12}/> Bedrooms
              </label>
              <input 
                type="number" 
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600" 
                value={form.bedrooms}
                onChange={(e) => setForm({...form, bedrooms: parseInt(e.target.value)})}
                required 
              />
            </div>
            {/* Bathrooms */}
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-500 uppercase ml-1 flex items-center gap-1">
                <Bath size={12}/> Bathrooms
              </label>
              <input 
                type="number" 
                step="0.5" 
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600" 
                value={form.bathrooms}
                onChange={(e) => setForm({...form, bathrooms: parseFloat(e.target.value)})}
                required 
              />
            </div>
          </div>

          {/* Rent Amount */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-500 uppercase ml-1 flex items-center gap-1">
              <DollarSign size={12}/> Monthly Rent
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
              <input 
                type="number" 
                className="w-full pl-8 pr-5 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-600" 
                placeholder="0.00"
                value={form.monthly_rent}
                onChange={(e) => setForm({...form, monthly_rent: parseFloat(e.target.value)})}
                required 
              />
            </div>
          </div>

          {/* Occupancy Toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex flex-col">
              <label htmlFor="occupied" className="text-sm font-bold text-slate-700">Occupancy Status</label>
              <span className="text-[10px] text-slate-400 font-medium">Is there currently a tenant in this unit?</span>
            </div>
            <input 
              type="checkbox" 
              id="occupied"
              className="w-6 h-6 rounded-lg accent-indigo-600 cursor-pointer"
              checked={form.is_occupied}
              onChange={(e) => setForm({...form, is_occupied: e.target.checked})}
            />
          </div>

          {/* Action Button */}
          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-slate-900 text-white font-black py-5 rounded-[20px] hover:bg-black transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 size={20} className="animate-spin" />}
            {submitting 
              ? (initialData ? 'Saving...' : 'Creating...') 
              : (initialData ? 'Update Unit Details' : 'Confirm & Add Unit')}
          </button>
        </form>
      </div>
    </div>
  );
}