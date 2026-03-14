'use client';

import { useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

type Invoice = {
  id: string;
  tenant_id: string;
  lease_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: 'UNPAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  pdf_s3_key?: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  invoice_id: string;
  tenant_id: string;
  amount: number;
  payment_date: string;
  method?: string | null;
  external_reference?: string | null;
  status?: string | null;
  created_at: string;
};

const formatCurrency = (value?: number | null) => {
  const amount = value ?? 0;
  return `ETB ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceError, setInvoiceError] = useState(false);
  const [paymentError, setPaymentError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [invoicesResponse, paymentsResponse] = await Promise.all([
          apiClient.get('/api/invoices/mine').catch((error: Error) => ({ error })),
          apiClient.get('/api/payments/mine').catch((error: Error) => ({ error })),
        ]);

        if (!isMounted) return;

        if ('error' in invoicesResponse) {
          setInvoiceError(true);
        } else {
          const data = (invoicesResponse?.data ?? invoicesResponse) as Invoice[] | null;
          setInvoices(data ?? []);
        }

        if ('error' in paymentsResponse) {
          setPaymentError(true);
        } else {
          const data = (paymentsResponse?.data ?? paymentsResponse) as Payment[] | null;
          setPayments(data ?? []);
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

  const outstandingInvoices = invoices.filter(
    (invoice) => invoice.status === 'UNPAID' || invoice.status === 'OVERDUE'
  );
  const outstandingTotal = outstandingInvoices.reduce(
    (sum, invoice) => sum + (invoice.total_amount ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="h-20 rounded-xl bg-stone-100 animate-pulse" />
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="h-24 rounded-xl bg-stone-100 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <section
            className={`rounded-2xl bg-white p-6 shadow-sm ${
              outstandingInvoices.length > 0 ? 'border border-amber-200' : 'border border-stone-200'
            }`}
          >
            {invoiceError ? (
              <p className="text-sm text-stone-400">Unable to load invoices</p>
            ) : outstandingInvoices.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-bold text-stone-900">
                    {formatCurrency(outstandingTotal)} outstanding
                  </p>
                </div>
                <div className="space-y-3">
                  {outstandingInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-xl border border-stone-100 bg-stone-50 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-stone-900">
                          {invoice.invoice_number}
                        </p>
                        <p className="text-xs text-stone-400">
                          Due {formatDateOnly(invoice.due_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-stone-900">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            invoice.status === 'OVERDUE'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-stone-500">
                  Contact your property manager to arrange payment
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <div>
                  <p className="text-base font-semibold text-stone-900">
                    All payments up to date
                  </p>
                  <p className="text-sm text-stone-500">No outstanding balance</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">Payment History</h2>
            {paymentError ? (
              <p className="mt-4 text-sm text-stone-400">Unable to load payments</p>
            ) : payments.length === 0 ? (
              <p className="mt-4 text-sm text-stone-400">No payment records yet</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {formatTimestamp(payment.payment_date)}
                      </p>
                      {payment.method ? (
                        <p className="text-xs text-stone-400">{payment.method}</p>
                      ) : null}
                      {payment.external_reference ? (
                        <p className="text-xs text-stone-400">{payment.external_reference}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-900">
                        {formatCurrency(payment.amount)}
                      </p>
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                        COMPLETED
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-stone-900">All Invoices</h2>
            {invoiceError ? (
              <p className="mt-4 text-sm text-stone-400">Unable to load invoices</p>
            ) : invoices.length === 0 ? (
              <p className="mt-4 text-sm text-stone-400">No invoices yet</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-stone-900">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-xs text-stone-400">
                        Issued {formatDateOnly(invoice.issue_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-stone-900">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          invoice.status === 'PAID'
                            ? 'bg-green-100 text-green-700'
                            : invoice.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-700'
                            : invoice.status === 'UNPAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
