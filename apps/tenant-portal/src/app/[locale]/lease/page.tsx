'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, FileText, FolderOpen, Home, MapPin } from 'lucide-react';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

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

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
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

function suffixDay(day: number) {
  if (day === 1 || day === 21 || day === 31) return `${day}st`;
  if (day === 2 || day === 22) return `${day}nd`;
  if (day === 3 || day === 23) return `${day}rd`;
  return `${day}th`;
}

export default function LeasePage() {
  const supabase = useMemo(() => createClient(), []);
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
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void Promise.all([supabase.auth.getSession(), loadData()]);

    return () => {
      isMounted = false;
    };
  }, [supabase]);

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

  const leaseStatus = lease?.status?.toUpperCase() ?? 'ACTIVE';

  const renderLeaseStatus = () => {
    if (!startDate || !endDate) return 'Lease details unavailable';
    if (today < startDate) {
      return `Starts in ${daysUntilStart} day${daysUntilStart === 1 ? '' : 's'}`;
    }
    if (today > endDate) {
      return 'Lease ended';
    }
    return `${monthsRemaining} month${monthsRemaining === 1 ? '' : 's'} remaining`;
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
      setTimeout(() => {
        setDownloadState((prev) => ({ ...prev, [documentId]: 'idle' }));
      }, 2000);
    }
  };

  const dueDay =
    lease?.start_date && lease.start_date.includes('-')
      ? parseInt(lease.start_date.split('-')[2] ?? '', 10)
      : null;

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="h-16 rounded-xl bg-stone-100 animate-pulse" />
            </div>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="h-20 rounded-xl bg-stone-100 animate-pulse" />
          </div>
        </div>
      ) : lease ? (
        <>
          <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-stone-900">
                  {lease.property_name ?? 'Your Property'}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-sm text-stone-500">
                  <Home className="h-4 w-4 text-amber-500" />
                  <span>
                    {lease.unit_code ? `Unit ${lease.unit_code}` : 'Unit'}
                    {lease.city ? ` · ${lease.city}` : ''}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-stone-500">
                  <MapPin className="h-4 w-4 text-amber-500" />
                  <span>{lease.property_address ?? 'Address on file'}</span>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {leaseStatus}
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-500">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>From</span>
                <span className="font-semibold text-stone-900">{formatDate(lease.start_date)}</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-sm text-stone-500">
                <Calendar className="h-4 w-4 text-amber-500" />
                <span>Until</span>
                <span className="font-semibold text-stone-900">{formatDate(lease.end_date)}</span>
              </div>
            </div>

            <div className="mt-4 mb-2">
              <div className="h-2 w-full rounded-full bg-stone-100">
                <div
                  className="h-2 rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <p className="text-sm text-stone-500">{renderLeaseStatus()}</p>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Monthly Rent
              </p>
              <p className="mt-2 text-2xl font-bold text-stone-900">
                {formatCurrency(lease.monthly_rent)}
              </p>
              <p className="mt-2 text-sm text-stone-500">
                {dueDay ? `Due on the ${suffixDay(dueDay)} of each month` : 'Due every month'}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Security Deposit
              </p>
              <p className="mt-2 text-2xl font-bold text-stone-900">
                {lease.security_deposit ? formatCurrency(lease.security_deposit) : '—'}
              </p>
              <p className="mt-2 text-sm text-stone-500">Held for lease duration</p>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-base font-semibold text-stone-900">
              <FolderOpen className="h-5 w-5 text-amber-500" />
              Lease Documents
            </div>

            {documentsError ? (
              <p className="mt-4 text-sm text-stone-400">Unable to load documents</p>
            ) : documents.length === 0 ? (
              <p className="mt-4 text-sm text-stone-400">No documents uploaded yet</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <div>
                        <p className="text-sm font-medium text-stone-900">
                          {doc.original_filename}
                        </p>
                        <p className="text-xs text-stone-400">{formatDate(doc.created_at)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-700 hover:border-amber-300 hover:text-amber-700"
                      disabled={downloadState[doc.id] === 'loading'}
                    >
                      <Download className="h-3.5 w-3.5" />
                      {downloadState[doc.id] === 'loading'
                        ? '...'
                        : downloadState[doc.id] === 'error'
                        ? 'Failed'
                        : 'Download'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="h-8 w-8 text-amber-500" />
            <p className="text-base font-semibold text-stone-900">No active lease found</p>
            <p className="text-sm text-stone-500">Reach out to your property manager for details.</p>
          </div>
        </section>
      )}
    </div>
  );
}
