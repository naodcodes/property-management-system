import { Building2, LayoutDashboard, Users, CreditCard, Settings, LogOut } from 'lucide-react';

export function Sidebar() {
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', active: true },
    { icon: Building2, label: 'Properties', active: false },
    { icon: Users, label: 'Tenants', active: false },
    { icon: CreditCard, label: 'Payments', active: false },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white hidden lg:flex flex-col p-6 fixed h-full shadow-2xl transition-all">
      {/* Brand Branding */}
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
          <Building2 className="text-white w-6 h-6" />
        </div>
        <span className="font-bold text-xl tracking-tight">PropAdmin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.label}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ${
              item.active 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="border-t border-slate-800 pt-6 mt-6 space-y-2">
        <button className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all text-sm">
          <Settings size={18} /> Settings
        </button>
        <button className="w-full flex items-center gap-3 p-3 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all text-sm">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}