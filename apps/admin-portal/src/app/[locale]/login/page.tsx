'use client';

import { useState } from 'react';
import { createClient } from '../../../lib/supabase/client';
import { usePathname, useRouter } from '@/src/lib/navigation'; 
import { useTranslations, useLocale } from 'next-intl';
import { Building2, Lock, Mail, Loader2, Home, Languages } from 'lucide-react';

export default function LoginPage() {
  const t = useTranslations('Login');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLanguageChange = (newLocale: string) => {
    // next-intl's useRouter.push takes the locale as an option
    router.push(pathname, { locale: newLocale });
    router.refresh();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const role = data.user?.app_metadata?.role || data.user?.user_metadata?.role;
    
    if (role !== 'ADMIN') {
      await supabase.auth.signOut();
      setError(t('accessDenied'));
      setLoading(false);
      return;
    }

    router.push(`/${locale}/dashboard`);
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Left Side: Branding/Visual */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com')]" />
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-500/20">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{t('title')}</h1>
          </div>
          <p className="text-slate-400 text-lg leading-relaxed">
            Manage your properties, units, and lease documents with ease. The ultimate dashboard for modern property managers.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4">
             <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Home className="text-indigo-400 mb-2 w-5 h-5" />
                <div className="text-white font-semibold">Unit Tracking</div>
             </div>
             <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
                <Lock className="text-indigo-400 mb-2 w-5 h-5" />
                <div className="text-white font-semibold">Secure Leases</div>
             </div>
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        {/* Floating Language Switcher */}
        <div className="absolute top-8 right-8 flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
          <Languages className="w-4 h-4 text-slate-400 ml-2" />
          <button 
            onClick={() => handleLanguageChange('en')}
            className={`px-3 py-1 text-xs font-bold rounded ${locale === 'en' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            EN
          </button>
          <button 
            onClick={() => handleLanguageChange('am')}
            className={`px-3 py-1 text-xs font-bold rounded ${locale === 'am' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            አማ
          </button>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden flex items-center gap-2">
             <Building2 className="w-6 h-6 text-indigo-600" />
             <span className="text-xl font-bold text-slate-900">PropManage</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">{t('welcome')}</h2>
            <p className="text-slate-500 mt-2 text-sm">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm flex items-center gap-2">
                <span className="font-bold">!</span> {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="email">
                {t('emailLabel')}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="admin@property.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                {t('passwordLabel')}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('submit')
              )}
            </button>
          </form>

          <footer className="mt-12 text-center text-slate-400 text-xs">
            &copy; {new Date().getFullYear()} {t('title')} Admin System. All rights reserved.
          </footer>
        </div>
      </div>
    </div>
  );
}
