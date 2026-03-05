'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Lock, Mail, Loader2, Languages, ShieldAlert, KeyRound, Coffee } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';

export default function TenantLoginPage() {
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
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
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
    
    if (role !== 'TENANT') {
      await supabase.auth.signOut();
      setError(t('accessDenied'));
      setLoading(false);
      return;
    }

    router.push(`/${locale}/dashboard`);
  };

  return (
    <div className="flex min-h-screen bg-[#fafaf9]"> {/* Stone-50 background */}
      {/* Visual Side - Brown/Earth Theme */}
      <div className="hidden lg:flex w-1/2 bg-[#451a03] items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')]" />
        
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-4 mb-8">
            <div className="bg-amber-100 p-4 rounded-2xl shadow-xl">
              <Home className="w-10 h-10 text-amber-900" />
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">{t('title')}</h1>
          </div>
          
          <p className="text-amber-100/70 text-xl leading-relaxed mb-10">
            Everything you need to manage your home, all in one warm and cozy place.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-900/40 backdrop-blur-md border border-amber-700/50 p-5 rounded-xl">
              <KeyRound className="text-amber-400 mb-3 w-6 h-6" />
              <div className="text-white font-medium">Secure Access</div>
            </div>
            <div className="bg-amber-900/40 backdrop-blur-md border border-amber-700/50 p-5 rounded-xl">
              <Coffee className="text-amber-400 mb-3 w-6 h-6" />
              <div className="text-white font-medium">Resident Perks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        {/* Floating Language Switcher */}
        <div className="absolute top-8 right-8 flex items-center gap-2 bg-white p-1.5 rounded-xl border border-stone-200 shadow-sm">
          <Languages className="w-4 h-4 text-stone-400 ml-2" />
          {['en', 'am'].map((l) => (
            <button
              key={l}
              onClick={() => handleLanguageChange(l)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                locale === l 
                ? 'bg-[#451a03] text-white shadow-md' 
                : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden flex items-center gap-2">
            <Home className="w-8 h-8 text-[#451a03]" />
            <span className="text-2xl font-bold text-stone-900">{t('title')}</span>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-extrabold text-stone-900 tracking-tight">{t('welcome')}</h2>
            <p className="text-stone-500 mt-3 text-lg">{t('subtitle')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 ml-1">{t('emailLabel')}</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-stone-400 group-focus-within:text-amber-700 transition-colors" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-700 outline-none transition-all text-stone-900 shadow-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-stone-700 ml-1">{t('passwordLabel')}</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-stone-400 group-focus-within:text-amber-700 transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-200 rounded-xl focus:ring-4 focus:ring-amber-100 focus:border-amber-700 outline-none transition-all text-stone-900 shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#451a03] hover:bg-[#2d1102] text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-900/20 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin text-amber-200" />
              ) : (
                <span className="text-lg">{t('submit')}</span>
              )}
            </button>
          </form>

          <footer className="mt-16 text-center">
            <p className="text-stone-400 text-sm italic">
              &copy; {new Date().getFullYear()} {t('title')}. {locale === 'en' ? 'Welcome Home.' : 'እንኳን በደህና መጡ።'}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}