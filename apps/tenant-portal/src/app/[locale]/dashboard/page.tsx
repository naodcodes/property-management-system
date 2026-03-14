'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText, FolderOpen, Home, Wrench } from 'lucide-react';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

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
  const [displayName, setDisplayName] = useState('tenant@betoch.app');
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
      setDisplayName(firstName?.trim() || user?.email || 'tenant@betoch.app');
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
  const leaseBadgeClass =
    leaseStatus === 'ACTIVE'
      ? 'bg-amber-100 text-amber-800'
      : leaseStatus === 'EXPIRED'
      ? 'bg-red-100 text-red-700'
      : 'bg-yellow-100 text-yellow-700';

  const nextPaymentDue = nextInvoice?.due_date ? formatDate(nextInvoice.due_date) : null;
  const invoiceIsOverdue =
    nextInvoice?.status === 'OVERDUE' ||
    (nextInvoice?.due_date ? new Date(nextInvoice.due_date) < new Date() : false);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
          <Home className="h-3.5 w-3.5" />
          Tenant Overview
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
          Welcome home, {displayName}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Here is a quick summary of your lease, payments, and requests.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="border-stone-200 bg-white shadow-sm">
              <CardContent className="min-h-[160px] p-5">
                <div className="space-y-3">
                  <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
                  <div className="h-5 w-32 rounded bg-stone-100 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-stone-100 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            {/* Lease Status */}
            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[160px] flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Lease
                  </span>
                  <FileText className="h-4 w-4 text-amber-500" />
                </div>
                {errors.lease ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-stone-400">Unable to load</p>
                  </div>
                ) : lease ? (
                  <div className="space-y-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${leaseBadgeClass}`}>
                      {leaseStatus}
                    </span>
                    <p className="text-sm font-semibold text-stone-900 leading-snug">
                      {lease.property_name ?? 'Property'}
                      {lease.unit_code ? ` — Unit ${lease.unit_code}` : ''}
                    </p>
                    <p className="text-xs text-stone-400">
                      {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-stone-400">No active lease</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next Payment */}
            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[160px] flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Payments
                  </span>
                  <CreditCard className="h-4 w-4 text-amber-500" />
                </div>
                {errors.invoices ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-stone-400">Unable to load</p>
                  </div>
                ) : nextInvoice ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {invoiceIsOverdue && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold ${invoiceIsOverdue ? 'text-red-600' : 'text-stone-900'}`}>
                      {formatCurrency(nextInvoice.total_amount)} due
                    </p>
                    {nextPaymentDue && (
                      <p className="text-xs text-stone-400">Due {nextPaymentDue}</p>
                    )}
                    <Link href="/invoices" className="text-xs font-medium text-amber-700">
                      View invoice →
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                      <p className="text-sm font-semibold text-stone-900">
                        All payments up to date
                      </p>
                    </div>
                    <p className="text-xs text-stone-400">
                      No outstanding balance
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maintenance */}
            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[160px] flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Maintenance
                  </span>
                  <Wrench className="h-4 w-4 text-amber-500" />
                </div>
                {errors.maintenance ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-stone-400">Unable to load</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {openTickets !== null && openTickets > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                          <p className="text-sm font-semibold text-stone-900">
                            {openTickets} request{openTickets > 1 ? 's' : ''} in progress
                          </p>
                        </div>
                        <p className="text-xs text-stone-400">
                          We are working on it
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-400 flex-shrink-0" />
                          <p className="text-sm font-semibold text-stone-900">
                            No open requests
                          </p>
                        </div>
                      </>
                    )}
                    <Link href="/maintenance" className="text-xs font-medium text-amber-700">
                      View requests →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="border-stone-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[160px] flex-col justify-between p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Documents
                  </span>
                  <FolderOpen className="h-4 w-4 text-amber-500" />
                </div>
                {errors.documents ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-stone-400">Unable to load</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documentCount && documentCount > 0 ? (
                      <>
                        <p className="text-sm font-semibold text-stone-900">
                          {documentCount} document{documentCount > 1 ? 's' : ''} available
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-stone-900">
                          No documents yet
                        </p>
                        <p className="text-xs text-stone-400">
                          Files will appear here
                        </p>
                      </>
                    )}
                    <Link href="/lease" className="text-xs font-medium text-amber-700">
                      View in My Lease →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Link
          href="/invoices"
          className="inline-flex items-center justify-center rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Pay Rent
        </Link>
        <Link
          href="/maintenance"
          className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700"
        >
          Report Issue
        </Link>
        <Link
          href="/lease"
          className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700"
        >
          View Lease
        </Link>
      </div>
    </div>
  );
}
