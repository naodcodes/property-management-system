'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText, FolderOpen, LayoutDashboard, Wrench } from 'lucide-react';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type Lease = {
  id: string;
  status?: string | null;
  property_name?: string | null;
  unit_code?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

type Invoice = {
  id: string;
  status?: string | null;
  due_date?: string | null;
  total_amount?: number | null;
};

type Ticket = {
  id: string;
  status?: string | null;
};

type LeaseDocument = {
  id: string;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined) return 'ETB 0';
  return `ETB ${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

export default function TenantDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [nextInvoice, setNextInvoice] = useState<Invoice | null>(null);
  const [openTickets, setOpenTickets] = useState<number | null>(null);
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({
    lease: false,
    invoices: false,
    maintenance: false,
    documents: false,
  });

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      const firstName = user?.user_metadata?.first_name as string | undefined;
      setDisplayName(firstName?.trim() || user?.email || null);
    };

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [leaseResponse, invoiceResponse, maintenanceResponse, documentsResponse] =
          await Promise.all([
            apiClient.get('/api/leases/mine').catch((error: Error) => ({ error })),
            apiClient.get('/api/invoices').catch((error: Error) => ({ error })),
            apiClient.get('/api/maintenance').catch((error: Error) => ({ error })),
            apiClient.get('/api/lease-documents').catch((error: Error) => ({ error })),
          ]);

        if (!isMounted) return;

        if ('error' in leaseResponse) {
          setErrors((prev) => ({ ...prev, lease: true }));
        } else {
          const leaseData = leaseResponse?.data ?? leaseResponse;
          setLease(Array.isArray(leaseData) ? leaseData[0] ?? null : leaseData ?? null);
        }

        if ('error' in invoiceResponse) {
          setErrors((prev) => ({ ...prev, invoices: true }));
        } else {
          const invoices = (invoiceResponse?.data ?? invoiceResponse) as Invoice[] | null;
          const pending = (invoices ?? [])
            .filter((invoice) => ['UNPAID', 'OVERDUE'].includes(invoice.status ?? ''))
            .sort((a, b) => {
              const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
              const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
              return aTime - bTime;
            });
          setNextInvoice(pending[0] ?? null);
        }

        if ('error' in maintenanceResponse) {
          setErrors((prev) => ({ ...prev, maintenance: true }));
        } else {
          const tickets = (maintenanceResponse?.data ?? maintenanceResponse) as Ticket[] | null;
          const count = (tickets ?? []).filter((ticket) =>
            ['OPEN', 'IN_PROGRESS'].includes(ticket.status ?? '')
          ).length;
          setOpenTickets(count);
        }

        if ('error' in documentsResponse) {
          setErrors((prev) => ({ ...prev, documents: true }));
        } else {
          const documents = (documentsResponse?.data ?? documentsResponse) as LeaseDocument[] | null;
          setDocumentCount((documents ?? []).length);
        }
      } catch {
        if (!isMounted) return;
        setErrors({ lease: true, invoices: true, maintenance: true, documents: true });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void Promise.all([loadUser(), loadDashboard()]);
    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const leaseStatus = lease?.status?.toUpperCase() ?? null;
  const nextPaymentDue = nextInvoice?.due_date ? formatDate(nextInvoice.due_date) : null;
  const invoiceIsOverdue =
    nextInvoice?.status === 'OVERDUE' ||
    (nextInvoice?.due_date ? new Date(nextInvoice.due_date) < new Date() : false);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard size={16} className="text-amber-700" />
          <p className="text-amber-700 font-black text-xs uppercase tracking-widest">
            Tenant Portal
          </p>
        </div>
        {displayName ? (
          <h1 className="text-4xl font-black tracking-tight text-stone-900 animate-in fade-in duration-300">
            Welcome home, {displayName}
          </h1>
        ) : (
          <div className="h-10 w-72 rounded-lg bg-stone-100 animate-pulse" />
        )}
        <p className="text-stone-400 font-medium text-sm mt-1">
          Here is a quick summary of your lease, payments, and requests.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="rounded-[32px] bg-white p-8 shadow-sm"
            >
              <div className="space-y-3">
                <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
                <div className="h-5 w-32 rounded bg-stone-100 animate-pulse" />
                <div className="h-3 w-20 rounded bg-stone-100 animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          <>
            {/* Lease Status */}
            <div className="group relative bg-white p-8 rounded-[32px] border-2 border-transparent hover:border-stone-900 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col min-h-[260px]">              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-amber-100 text-amber-600 shadow-md shadow-amber-100">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <p className="text-stone-400 font-black text-[10px] uppercase tracking-widest leading-none mb-2">
                LEASE
              </p>
              {errors.lease ? (
                <>
                  <h3 className="text-3xl font-black text-stone-900 mb-2">—</h3>
                  <p className="text-stone-400 text-xs font-medium">Unable to load</p>
                </>
              ) : lease ? (
                <>
                  <h3 className="text-2xl font-black text-stone-900 mb-2">{leaseStatus}</h3>
                  <p className="text-sm text-stone-900 font-semibold">
                    {lease.property_name ?? 'Property'}
                    {lease.unit_code ? ` — Unit ${lease.unit_code}` : ''}
                  </p>
                  <p className="text-stone-400 text-xs font-medium">
                    {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-5xl font-black text-stone-900 mb-2">—</h3>
                  <p className="text-stone-400 text-xs font-medium">No active lease</p>
                </>
              )}
              <div className="mt-auto pt-4">
                <Link
                  href="/lease"
                  className="text-xs font-black text-amber-700 uppercase tracking-widest hover:text-amber-900"
                >
                  View Lease →
                </Link>
              </div>
            </div>

            {/* Next Payment */}
            <div className="group relative bg-white p-8 rounded-[32px] border-2 border-transparent hover:border-stone-900 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col min-h-[260px]">              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-amber-100 text-amber-600 shadow-md shadow-amber-100">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
              <p className="text-stone-400 font-black text-[10px] uppercase tracking-widest leading-none mb-2">
                PAYMENTS
              </p>
              {errors.invoices ? (
                <>
                  <h3 className="text-5xl font-black text-stone-900 mb-2">—</h3>
                  <p className="text-stone-400 text-xs font-medium">Unable to load</p>
                </>
              ) : nextInvoice ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={cn(
                      'text-3xl font-black',
                      invoiceIsOverdue ? 'text-red-600' : 'text-stone-900'
                    )}>
                      {formatCurrency(nextInvoice.total_amount)}
                    </h3>
                  </div>
                  {invoiceIsOverdue && (
                    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-black text-red-700 mb-1">
                      OVERDUE
                    </span>
                  )}
                  {nextPaymentDue ? (
                    <p className="text-stone-400 text-xs font-medium">Due {nextPaymentDue}</p>
                  ) : null}
                </>
              ) : (
                <>
                  <h3 className="text-3xl font-black text-stone-900 mb-2">
                    Up to date
                  </h3>
                  <p className="text-stone-400 text-xs font-medium">
                    {lease?.start_date
                      ? (() => {
                          const day = parseInt(lease.start_date.split('-')[2] ?? '1', 10);
                          const now = new Date();
                          const next = new Date(now.getFullYear(), now.getMonth(), day);
                          if (next <= now) {
                            next.setMonth(next.getMonth() + 1);
                          }
                          return `Next due ${new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                          }).format(next)}`;
                        })()
                      : 'No outstanding balance'}
                  </p>
                </>
              )}
              <div className="mt-auto pt-4">
                <Link
                  href="/payments"
                  className="text-xs font-black text-amber-700 uppercase tracking-widest hover:text-amber-900"
                >
                  View Payments →
                </Link>
              </div>
            </div>

            {/* Maintenance */}
            <div className="group relative bg-white p-8 rounded-[32px] border-2 border-transparent hover:border-stone-900 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col min-h-[260px]">              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-amber-100 text-amber-600 shadow-md shadow-amber-100">
                  <Wrench className="h-5 w-5" />
                </div>
              </div>
              <p className="text-stone-400 font-black text-[10px] uppercase tracking-widest leading-none mb-2">
                MAINTENANCE
              </p>
              {errors.maintenance ? (
                <>
                  <h3 className="text-5xl font-black text-stone-900 mb-2">—</h3>
                  <p className="text-stone-400 text-xs font-medium">Unable to load</p>
                </>
              ) : (
                <>
                  <h3 className="text-3xl font-black text-stone-900 mb-2">
                    {openTickets ?? 0}
                  </h3>
                  <p className="text-stone-400 text-xs font-medium">
                    {openTickets && openTickets > 0 ? 'open requests' : 'all resolved'}
                  </p>
                </>
              )}
              <div className="mt-auto pt-4">
                <Link
                  href="/maintenance"
                  className="text-xs font-black text-amber-700 uppercase tracking-widest hover:text-amber-900"
                >
                  View Requests →
                </Link>
              </div>
            </div>

            {/* Documents */}
            <div className="group relative bg-white p-8 rounded-[32px] border-2 border-transparent hover:border-stone-900 transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col min-h-[260px]">              <div className="flex justify-between items-start mb-6">
                <div className="p-4 rounded-2xl bg-amber-100 text-amber-600 shadow-md shadow-amber-100">
                  <FolderOpen className="h-5 w-5" />
                </div>
              </div>
              <p className="text-stone-400 font-black text-[10px] uppercase tracking-widest leading-none mb-2">
                DOCUMENTS
              </p>
              {errors.documents ? (
                <>
                  <h3 className="text-5xl font-black text-stone-900 mb-2">—</h3>
                  <p className="text-stone-400 text-xs font-medium">Unable to load</p>
                </>
              ) : (
                <>
                  <h3 className="text-3xl font-black text-stone-900 mb-2">
                    {documentCount ?? 0}
                  </h3>
                  <p className="text-stone-400 text-xs font-medium">
                    {documentCount && documentCount > 0 ? 'documents available' : 'no documents'}
                  </p>
                </>
              )}
              <div className="mt-auto pt-4">
                <Link
                  href="/lease"
                  className="text-xs font-black text-amber-700 uppercase tracking-widest hover:text-amber-900"
                >
                  View in My Lease →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Link
          href="/payments"
          className="bg-stone-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-sm active:scale-95"
        >
          Pay Rent
        </Link>
        <Link
          href="/maintenance"
          className="bg-white border-2 border-stone-900 text-stone-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-900 hover:text-white transition-all shadow-sm active:scale-95"
        >
          Report Issue
        </Link>
        <Link
          href="/lease"
          className="bg-white border-2 border-stone-900 text-stone-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-900 hover:text-white transition-all shadow-sm active:scale-95"
        >
          View Lease
        </Link>
      </div>
    </div>
  );
}
