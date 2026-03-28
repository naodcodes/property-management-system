'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Calendar,
  Download,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  MapPin,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { defaultLocale } from '@/i18n/config';

type Lease = {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit?: number | null;
  status?: string | null;
  signed_at?: string | null;
  unit_code?: string | null;
  property_name?: string | null;
  property_address?: string | null;
  city?: string | null;
};

type LeaseDocument = {
  id: string;
  lease_id: string | null;
  tenant_id: string | null;
  s3_key: string;
  original_filename: string;
  mime_type: string;
  created_at: string;
};

type DownloadState = Record<string, 'idle' | 'loading' | 'error'>;

// Updated: Accepts locale
const formatDate = (value?: string | null, locale: string = 'en') => {
  if (!value) return '—';
  const date = value.match(/^\d{4}-\d{2}-\d{2}$/) 
    ? new Date(value.split('-').map(Number)[0], value.split('-').map(Number)[1] - 1, value.split('-').map(Number)[2])
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;
  
  return new Intl.DateTimeFormat(locale === 'am' ? 'en-GB' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return '—';
  return `ETB ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function LeasePage() {
  const supabase = useMemo(() => createClient(), []);
  const locale = useLocale();
  const t = useTranslations('Lease');
  
  const [lease, setLease] = useState<Lease | null>(null);
  const [documents, setDocuments] = useState<LeaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState>({});

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [leaseResponse, documentsResponse] = await Promise.all([
          apiClient.get('/api/leases/mine').catch((error: Error) => ({ error })),
          apiClient.get('/api/lease-documents').catch((error: Error) => ({ error })),
        ]);
        if (!isMounted) return;
        if ('error' in leaseResponse) {
          setLease(null);
        } else {
          const leaseData = leaseResponse?.data ?? leaseResponse;
          setLease(Array.isArray(leaseData) ? leaseData[0] ?? null : leaseData ?? null);
        }
        if ('error' in documentsResponse) {
          setDocumentsError(true);
        } else {
          const docs = (documentsResponse?.data ?? documentsResponse) as LeaseDocument[] | null;
          setDocuments(docs ?? []);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void loadData();
    return () => { isMounted = false; };
  }, []);

  const parseDateSafe = (str: string) => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  
  const startDate = lease?.start_date ? parseDateSafe(lease.start_date) : null;
  const endDate = lease?.end_date ? parseDateSafe(lease.end_date) : null;
  const today = new Date();

  const totalDays = startDate && endDate ? Math.max(daysBetween(startDate, endDate), 1) : 0;
  const elapsedDays = startDate ? clamp(daysBetween(startDate, today), 0, totalDays) : 0;
  const progressPercent = totalDays ? clamp((elapsedDays / totalDays) * 100, 0, 100) : 0;

  const daysUntilStart = startDate ? daysBetween(today, startDate) : 0;
  const daysUntilEnd = endDate ? daysBetween(today, endDate) : 0;
  const monthsRemaining = Math.max(0, Math.ceil(daysUntilEnd / 30));

  const leaseStatus = lease?.status === 'ACTIVE' ? t('active') : t('expired');

  const renderLeaseStatusText = () => {
    if (!startDate || !endDate) return t('leaseUnavailable');
    if (today < startDate) {
      return `${t('startsIn')} ${daysUntilStart} ${daysUntilStart === 1 ? t('day') : t('days')}`;
    }
    if (today > endDate) {
      return t('leaseEnded');
    }
    return `${monthsRemaining} ${monthsRemaining === 1 ? t('monthRemaining') : t('monthsRemaining')}`;
  };

  const handleDownload = async (documentId: string) => {
    setDownloadState((prev) => ({ ...prev, [documentId]: 'loading' }));
    try {
      const response = await apiClient.get(`/api/lease-documents/${documentId}/download`);
      const downloadUrl = response?.downloadUrl ?? response?.data?.downloadUrl;
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
        setDownloadState((prev) => ({ ...prev, [documentId]: 'idle' }));
        return;
      }
      throw new Error('Missing download URL');
    } catch {
      setDownloadState((prev) => ({ ...prev, [documentId]: 'error' }));
      setTimeout(() => setDownloadState((prev) => ({ ...prev, [documentId]: 'idle' })), 2000);
    }
  };

  const dueDay = lease?.start_date ? parseInt(lease.start_date.split('-')[2] ?? '', 10) : null;

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard size={16} className="text-amber-700" />
          <p className="text-amber-700 font-black text-xs uppercase tracking-widest">
            {t('pageLabel')}
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-stone-900">{t('pageTitle')}</h1>
        <p className="text-stone-400 font-medium text-sm mt-1">{t('pageSubtitle')}</p>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-[32px] bg-white p-8 h-48 shadow-sm" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[32px] bg-white p-8 h-32 shadow-sm" />
            <div className="rounded-[32px] bg-white p-8 h-32 shadow-sm" />
          </div>
        </div>
      ) : lease ? (
        <>
          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-amber-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-4xl font-black tracking-tight text-stone-900">{lease.property_name ?? 'Property'}</h1>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-stone-500">
                  <Home className="h-4 w-4 text-amber-500" />
                  <span>{t('unitLabel', { defaultValue: 'Unit' })} {lease.unit_code}{lease.city ? ` · ${lease.city}` : ''}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-stone-500">
                  <MapPin className="h-4 w-4 text-amber-500" />
                  <span>{lease.property_address ?? 'Address'}</span>
                </div>
              </div>
              <span className="flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-amber-700 border border-amber-200">
                {leaseStatus}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-500">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>{t('from')}</span>
                <span className="font-black text-stone-900">{formatDate(lease.start_date, locale)}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-500">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>{t('until')}</span>
                <span className="font-black text-stone-900">{formatDate(lease.end_date, locale)}</span>
              </div>
            </div>

            <div className="mt-4 mb-2">
              <div className="h-2 w-full rounded-full bg-stone-100">
                <div className="h-2 rounded-full bg-amber-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mt-2">{renderLeaseStatusText()}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('monthlyRentLabel')}</p>
              <p className="mt-2 text-3xl font-black text-stone-900">{formatCurrency(lease.monthly_rent)}</p>
              <p className="text-xs font-medium text-stone-400 mt-1">
                {dueDay ? `${t('dueOnThe')} ${dueDay} ${t('ofEachMonth')}` : t('dueEveryMonth')}
              </p>
            </div>
            <div className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('securityDepositLabel')}</p>
              <p className="mt-2 text-3xl font-black text-stone-900">{lease.security_deposit ? formatCurrency(lease.security_deposit) : '—'}</p>
              <p className="text-xs font-medium text-stone-400 mt-1">{t('heldForLeaseDuration')}</p>
            </div>
          </section>

          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">{t('documentsLabel')}</p>
                <h2 className="text-2xl font-black text-stone-900">{t('leaseDocuments')}</h2>
              </div>
              <FolderOpen className="h-6 w-6 text-amber-500" />
            </div>
            {documentsError ? (
              <p className="mt-4 text-sm text-stone-400">{t('unableToLoadDocuments')}</p>
            ) : documents.length === 0 ? (
              <p className="mt-4 text-sm text-stone-400">{t('noDocuments')}</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-sm font-black text-stone-900">{doc.original_filename}</p>
                        <p className="text-xs text-stone-400">{formatDate(doc.created_at, locale)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="bg-white border-2 border-stone-900 text-stone-900 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-900 hover:text-white transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
                      disabled={downloadState[doc.id] === 'loading'}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadState[doc.id] === 'loading' ? t('downloading') : downloadState[doc.id] === 'error' ? t('failed') : t('download')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-dashed border-stone-200">
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="h-8 w-8 text-amber-500" />
            <p className="text-base font-black text-stone-900">{t('noLeaseFound')}</p>
            <p className="text-xs font-medium text-stone-400">{t('noLeaseSubtitle')}</p>
          </div>
        </section>
      )}
    </div>
  );
}