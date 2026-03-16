// components/Sidebar.tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Building2, 
  Wrench, 
  DollarSign, 
  LogOut,
  User,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

const MENU_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: Building2, label: 'Properties', href: '/properties' },
  { icon: Wrench, label: 'Maintenance', href: '/maintenance' },
  { icon: DollarSign, label: 'Payments', href: '/payments' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#0F172A] border-r border-white/10 hidden lg:flex flex-col z-50 text-white shadow-2xl">
      {/* BRANDING SECTION */}
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <ShieldCheck size={22} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">PropMan</span>
        </div>

        {/* NAVIGATION */}
        <nav className="space-y-1.5">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                  isActive 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'text-indigo-200/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="font-bold text-sm">{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="opacity-50" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* USER & LOGOUT SECTION */}
      <div className="mt-auto p-6 bg-black/20">
        <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/5 bg-white/5 mb-4">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/30">
            <User size={18} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">Admin Portal</p>
            <p className="text-[10px] text-indigo-300/50 font-bold truncate">naod.as@gmail.com</p>
          </div>
        </div>
        
        <button className="flex items-center gap-4 px-4 py-3 w-full text-indigo-300/40 hover:text-rose-400 transition-colors font-bold text-xs uppercase tracking-widest group">
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}