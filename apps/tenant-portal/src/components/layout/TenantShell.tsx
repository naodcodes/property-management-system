'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import {
  Home,
  FileText,
  CreditCard,
  Wrench,
  User,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { defaultLocale } from '@/i18n/config';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export default function TenantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const localeParam = typeof params?.locale === 'string' ? params.locale : defaultLocale;
  const localePrefix = localeParam === defaultLocale ? '' : `/${localeParam}`;
  const supabase = useMemo(() => createClient(), []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState('tenant@betoch.app');

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isMounted && user?.email) {
        setEmail(user.email);
      }
    };
    void loadUser();
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  if (pathname.includes('/login')) {
    return <>{children}</>;
  }

  const navItems: NavItem[] = [
    { href: `${localePrefix}/dashboard`, label: 'Dashboard', icon: Home },
    { href: `${localePrefix}/lease`, label: 'My Lease', icon: FileText },
    { href: `${localePrefix}/payments`, label: 'Payments', icon: CreditCard },
    { href: `${localePrefix}/maintenance`, label: 'Maintenance', icon: Wrench },
    { href: `${localePrefix}/profile`, label: 'Profile', icon: User },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-amber-700/30 bg-[#451a03] text-amber-100',
          'transform transition-transform duration-200 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-amber-700/30 px-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-700 p-2">
              <Home className="h-5 w-5 text-amber-100" />
            </div>
            <span className="text-lg font-bold text-white">Betoch</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-amber-100 hover:bg-amber-800 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="px-4 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname === `${item.href}/`;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40'
                        : 'text-amber-100/75 hover:bg-amber-900/40 hover:text-amber-100'
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {mobileOpen ? (
        <button
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu overlay"
        />
      ) : null}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-stone-200 bg-white/95 px-4 backdrop-blur lg:px-8">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-stone-900">Tenant Portal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-stone-500">Signed in as</p>
              <p className="max-w-[220px] truncate text-sm font-medium text-stone-900">{email}</p>
            </div>
            <Badge className="bg-amber-700 text-amber-50 hover:bg-amber-700" variant="default">
              TENANT
            </Badge>
            <Button
              variant="ghost"
              className="text-stone-600 hover:bg-amber-50 hover:text-amber-800"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
