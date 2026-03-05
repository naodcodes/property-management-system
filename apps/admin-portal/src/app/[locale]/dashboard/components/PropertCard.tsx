import { Building2, MapPin, Plus, Bed, Bath, Edit3, UserPlus } from 'lucide-react';

// Added onEditUnit and onAssignTenant to the props
export function PropertyCard({ property, onAddUnit, onEditUnit, onAssignTenant }: any) {
  if (!property) return null;

  const units = property.units || [];

  return (
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-8">
      <div className="flex justify-between items-start mb-6">
        <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600">
          <Building2 size={32} />
        </div>
        <button 
          onClick={() => onAddUnit(property)} 
          className="bg-indigo-50 px-4 py-2 rounded-xl text-indigo-600 font-bold text-sm flex items-center gap-2 hover:bg-indigo-100 transition-colors"
        >
           <Plus size={16} /> Add Unit
        </button>
      </div>

      <h3 className="text-2xl font-bold text-slate-900">{property.name}</h3>
      <p className="text-slate-400 text-sm mb-6 flex items-center gap-1"><MapPin size={14} /> {property.city}, {property.state}</p>

      <div className="space-y-2">
        {units.length > 0 ? (
          units.map((unit: any) => (
            <div 
              key={unit.id} 
              className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-300 transition-all"
            >
              <div className="flex flex-col">
                <span className="font-bold text-slate-700">{unit.unit_code}</span>
                <div className="flex gap-2 text-[10px] text-slate-400 font-bold uppercase">
                  <span>{unit.bedrooms} Bed</span>
                  <span>{unit.bathrooms} Bath</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-indigo-600 font-bold">${unit.monthly_rent}</span>
                
                {/* ACTION BUTTONS */}
                <div className="flex gap-1">
                  <button 
                    onClick={() => onEditUnit(unit, property.name)}
                    className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                    title="Edit Unit"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button 
                    onClick={() => onAssignTenant(unit, property.name)}
                    className="p-2 hover:bg-white rounded-lg text-slate-400 hover:text-emerald-600 transition-colors"
                    title="Assign Tenant"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-4 text-slate-400 text-sm italic">No units added</p>
        )}
      </div>
    </div>
  );
}