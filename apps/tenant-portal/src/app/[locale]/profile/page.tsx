'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

type TenantProfile = {
  id: string;
  user_id: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  current_unit_id: string | null;
  unit_code: string | null;
  property_name: string | null;
  property_address: string | null;
  city: string | null;
  created_at?: string | null;
};

export default function ProfilePage() {
  const supabase = useMemo(() => createClient(), []);
  const locale = useLocale();
  const t = useTranslations('Profile');

  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [profileResponse, userResponse] = await Promise.all([
          apiClient.get('/api/tenants/me').catch((error: Error) => ({ error })),
          supabase.auth.getUser(),
        ]);
        if (!isMounted) return;
        if ('error' in profileResponse) {
          setProfileError(true);
        } else {
          const data = (profileResponse?.data ?? profileResponse) as TenantProfile | null;
          setProfile(data ?? null);
          if (data) {
            setPhone(data.phone ?? '');
            setEmergencyName(data.emergency_contact_name ?? '');
            setEmergencyPhone(data.emergency_contact_phone ?? '');
          }
        }
        const user = userResponse?.data?.user;
        if (user) {
          setEmail(user.email ?? '');
          setFirstName((user.user_metadata?.first_name as string) ?? '');
          setLastName((user.user_metadata?.last_name as string) ?? '');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadData();
    return () => { isMounted = false; };
  }, [supabase]);

  const hasChanges =
    phone !== (profile?.phone ?? '') ||
    emergencyName !== (profile?.emergency_contact_name ?? '') ||
    emergencyPhone !== (profile?.emergency_contact_phone ?? '');

  const getInitials = () => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.slice(0, 2).toUpperCase();
    if (email) return email.slice(0, 2).toUpperCase();
    return '??';
  };

  const fullName = `${firstName} ${lastName}`.trim() || email || '—';

  const memberSinceFormatted = () => {
    if (!profile?.created_at) return '—';
    const date = new Date(profile.created_at);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale === 'am' ? 'en-GB' : 'en-US', { 
      month: 'short', 
      year: 'numeric' 
    }).format(date);
  };

  const handleSave = async () => {
    if (!profile || !hasChanges) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Record<string, string | null> = {};
      if (phone !== (profile.phone ?? '')) payload.phone = phone || null;
      if (emergencyName !== (profile.emergency_contact_name ?? '')) {
        payload.emergency_contact_name = emergencyName || null;
      }
      if (emergencyPhone !== (profile.emergency_contact_phone ?? '')) {
        payload.emergency_contact_phone = emergencyPhone || null;
      }
      const response = await apiClient.patch(`/api/tenants/${profile.id}/profile`, payload);
      const updated = (response?.data ?? response) as TenantProfile;
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError(t('unableToLoadSubtitle')); // Fallback to generic error from JSON
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (!currentPassword) {
      setPwError(t('enterCurrentPassword'));
      return;
    }
    if (newPassword.length < 8) {
      setPwError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t('passwordMismatch'));
      return;
    }
    setPwSaving(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (verifyError) {
      setPwError(t('incorrectPassword'));
      setPwSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwError(error.message);
    } else {
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPwSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard size={16} className="text-amber-700" />
          <p className="text-amber-700 font-black text-xs uppercase tracking-widest">{t('pageLabel')}</p>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-stone-900">{t('pageTitle')}</h1>
        <p className="text-stone-400 font-medium text-sm mt-1">{t('pageSubtitle')}</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`profile-skeleton-${index}`} className="rounded-[32px] bg-white p-8 border-2 border-transparent shadow-sm">
              <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
              <div className="mt-4 h-10 rounded-xl bg-stone-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : profileError ? (
        <div className="rounded-[32px] bg-white p-16 border-2 border-dashed border-stone-200 text-center">
          <p className="mt-4 text-base font-black text-stone-900">{t('unableToLoad')}</p>
          <p className="mt-2 text-xs font-medium text-stone-400">{t('unableToLoadSubtitle')}</p>
        </div>
      ) : (
        <>
          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent">
            <div className="flex flex-wrap items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-amber-700 flex items-center justify-center">
                <span className="text-2xl font-black text-white uppercase">{getInitials()}</span>
              </div>
              <div>
                <p className="text-2xl font-black text-stone-900">{fullName}</p>
                <p className="text-sm text-stone-400 font-medium mt-0.5">{email}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-3">
                  {profile?.property_name && profile?.unit_code
                    ? `${profile.property_name} · ${t('unitLabel')} ${profile.unit_code}`
                    : '—'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-1">
                  {t('memberSince')} {memberSinceFormatted()}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{t('contactLabel')}</p>
            <h2 className="text-2xl font-black text-stone-900 mb-6">{t('contactTitle')}</h2>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('phoneLabel')}</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  className="w-full rounded-2xl border-2 border-stone-200 px-4 py-3 text-sm text-stone-900 font-medium focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('emergencyNameLabel')}</label>
                <input
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder={t('emergencyNamePlaceholder')}
                  className="w-full rounded-2xl border-2 border-stone-200 px-4 py-3 text-sm text-stone-900 font-medium focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('emergencyPhoneLabel')}</label>
                <input
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  className="w-full rounded-2xl border-2 border-stone-200 px-4 py-3 text-sm text-stone-900 font-medium focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm active:scale-95 disabled:opacity-40"
              >
                {saving ? '...' : t('saveChanges')}
              </button>
              {saveSuccess && <p className="text-[10px] font-black uppercase tracking-widest text-green-600">{t('changesSaved')}</p>}
              {saveError && <p className="text-xs font-medium text-red-600">{saveError}</p>}
            </div>
          </section>

          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{t('securityLabel')}</p>
            <h2 className="text-2xl font-black text-stone-900 mb-2">{t('securityTitle')}</h2>
            <p className="text-xs font-medium text-stone-400 mb-6">{t('securitySubtitle')}</p>
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('currentPassword')}</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder={t('currentPasswordPlaceholder')}
                    className="w-full rounded-2xl border-2 border-stone-200 px-4 py-3 pr-12 text-sm text-stone-900 font-medium focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('newPassword')}</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('newPasswordPlaceholder')}
                    className="w-full rounded-2xl border-2 border-stone-200 px-4 py-3 pr-12 text-sm text-stone-900 font-medium focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-500">{t('confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('confirmPasswordPlaceholder')}
                    className="w-full rounded-2xl border-2 border-stone-200 px-4 py-3 pr-12 text-sm text-stone-900 font-medium focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                onClick={handlePasswordUpdate}
                disabled={!currentPassword || !newPassword || !confirmPassword || pwSaving}
                className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm active:scale-95 disabled:opacity-40"
              >
                {pwSaving ? '...' : t('updatePassword')}
              </button>
              {pwSuccess && <p className="text-[10px] font-black uppercase tracking-widest text-green-600">{t('passwordUpdated')}</p>}
              {pwError && <p className="text-xs font-medium text-red-600">{pwError}</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}