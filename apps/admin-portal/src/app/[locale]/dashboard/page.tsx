'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';

// Hooks & Components
import { useApi } from './hooks/useApi';
import { Sidebar } from './components/Sidebar';
import { PropertyCard } from './components/PropertCard';
import { PropertyModal } from './components/PropertyModal';
import { UnitModal } from './components/UnitModal';
import { TenantInviteModal } from './components/TenantInviteModal';

export default function AdminDashboard() {
  const { apiRequest } = useApi();
  
  // Data State
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Modal Visibility States
  const [isPropModalOpen, setPropModalOpen] = useState(false);
  const [isUnitModalOpen, setUnitModalOpen] = useState(false);
  const [isEditUnitModalOpen, setEditUnitModalOpen] = useState(false);
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  
  // Track Active Data
  const [activeProperty, setActiveProperty] = useState<{id: string, name: string} | null>(null);
  const [unitToEdit, setUnitToEdit] = useState<any>(null);
  const [unitForTenant, setUnitForTenant] = useState<any>(null);

  // --- DATA LOADING ---
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

  // --- HANDLERS ---
  const handleCreateProperty = async (payload: any) => {
    setSubmitting(true);
    try {
      await apiRequest('/api/properties', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setPropModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateUnit = async (payload: any) => {
    if (!activeProperty) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/properties/${activeProperty.id}/units`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setUnitModalOpen(false);
      setActiveProperty(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUnit = async (payload: any) => {
    if (!unitToEdit) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/units/${unitToEdit.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setEditUnitModalOpen(false);
      setUnitToEdit(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- PHASE 2: ONBOARDING HANDLER ---
  const handleOnboardTenant = async (payload: any) => {
    if (!unitForTenant) return;
    setSubmitting(true);
    try {
      // Hits your new backend route: router.post('/units/:id/onboard', ...)
      await apiRequest(`/api/units/${unitForTenant.id}/onboard`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      setInviteModalOpen(false);
      setUnitForTenant(null);
      loadData(); // Refresh to show unit is now occupied
      alert("Tenant invitation processed! Check the backend console for the simulated email.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- MODAL TRIGGERS ---
  const openUnitModal = (property: any) => {
    setActiveProperty({ id: property.id, name: property.name });
    setUnitModalOpen(true);
  };

  const openEditUnitModal = (unit: any, propertyName: string) => {
    setUnitToEdit({ ...unit, propertyName });
    setEditUnitModalOpen(true);
  };

  const openInviteModal = (unit: any, propertyName: string) => {
    setUnitForTenant({ ...unit, propertyName });
    setInviteModalOpen(true);
  };

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Portfolio</h1>
            <p className="text-slate-500 text-sm font-medium">Manage your assets and inventory</p>
          </div>
          <button 
            onClick={() => setPropModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} /> Add Property
          </button>
        </header>

        {properties.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {properties.map((p: any) => (
              <PropertyCard 
                key={p.id} 
                property={p} 
                onAddUnit={() => openUnitModal(p)} 
                onEditUnit={openEditUnitModal}
                onAssignTenant={openInviteModal} 
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No properties found. Start by adding one!</p>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {isPropModalOpen && (
        <PropertyModal 
          onClose={() => setPropModalOpen(false)} 
          onSubmit={handleCreateProperty} 
          submitting={submitting} 
        />
      )}

      {isUnitModalOpen && (
        <UnitModal 
          propertyName={activeProperty?.name}
          onClose={() => { setUnitModalOpen(false); setActiveProperty(null); }} 
          onSubmit={handleCreateUnit} 
          submitting={submitting} 
        />
      )}

      {isEditUnitModalOpen && (
        <UnitModal 
          propertyName={unitToEdit?.propertyName}
          initialData={unitToEdit}
          onClose={() => { setEditUnitModalOpen(false); setUnitToEdit(null); }} 
          onSubmit={handleUpdateUnit} 
          submitting={submitting} 
        />
      )}

      {isInviteModalOpen && (
        <TenantInviteModal
          unit={unitForTenant}
          propertyName={unitForTenant?.propertyName}
          onClose={() => { setInviteModalOpen(false); setUnitForTenant(null); }}
          onSubmit={handleOnboardTenant}
          submitting={submitting}
        />
      )}
    </div>
  );
}