'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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

const formatDateOnly = (value?: string | null, locale: string = 'en') => {
  if (!value) return '—';
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(locale === 'am' ? 'en-GB' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatTimestamp = (value?: string | null, locale: string = 'en') => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'am' ? 'en-GB' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const locale = useLocale();
  const t = useTranslations('Payments');
  
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
        if (isMounted) setLoading(false);
      }
    };

    void loadData();
    return () => { isMounted = false; };
  }, []);

  const outstandingInvoices = invoices.filter(
    (invoice) => invoice.status === 'UNPAID' || invoice.status === 'OVERDUE'
  );
  const outstandingTotal = outstandingInvoices.reduce(
    (sum, invoice) => sum + (invoice.total_amount ?? 0),
    0
  );

  // Helper to translate statuses dynamically
  const getStatusText = (status: string) => {
    switch (status) {
      case 'PAID': return t('paid');
      case 'UNPAID': return t('unpaid');
      case 'OVERDUE': return t('overdue');
      case 'CANCELLED': return t('cancelled');
      case 'COMPLETED': return t('completed');
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard size={16} className="text-amber-700" />
          <p className="text-amber-700 font-black text-xs uppercase tracking-widest">
            {t('pageLabel')}
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-stone-900">
          {t('pageTitle')}
        </h1>
        <p className="text-stone-400 font-medium text-sm mt-1">
          {t('pageSubtitle')}
        </p>
      </div>

      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="rounded-[32px] bg-white p-8 h-32 shadow-sm" />
          <div className="rounded-[32px] bg-white p-8 h-48 shadow-sm" />
        </div>
      ) : (
        <>
          <section
            className={`rounded-[32px] bg-white p-8 shadow-sm border-2 ${
              outstandingInvoices.length > 0 ? 'border-amber-200' : 'border-transparent'
            }`}
          >
            {invoiceError ? (
              <p className="text-sm text-stone-400">{t('unableToLoadInvoices')}</p>
            ) : outstandingInvoices.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="text-5xl font-black tracking-tight text-stone-900">
                    {formatCurrency(outstandingTotal)}
                  </p>
                  <p className="text-stone-400 font-black text-[10px] uppercase tracking-widest mt-1">
                    {t('outstanding')}
                  </p>
                </div>
                <div className="space-y-3">
                  {outstandingInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between rounded-2xl border border-stone-100 bg-stone-50 px-5 py-4"
                    >
                      <div>
                        <p className="text-sm font-black text-stone-900">
                          {invoice.invoice_number}
                        </p>
                        <p className="text-xs text-stone-400">
                          {t('due')} {formatDateOnly(invoice.due_date, locale)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-stone-900">
                          {formatCurrency(invoice.total_amount)}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-black ${
                            invoice.status === 'OVERDUE'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-stone-400 mt-4">
                  {t('contactManager')}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <div>
                  <p className="text-base font-black text-stone-900">
                    {t('allUpToDate')}
                  </p>
                  <p className="text-xs font-medium text-stone-400">{t('noOutstandingBalance')}</p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
              {t('paymentHistoryLabel')}
            </p>
            <h2 className="text-2xl font-black text-stone-900 mb-6">{t('paymentHistory')}</h2>
            {paymentError ? (
              <p className="mt-4 text-sm text-stone-400">{t('unableToLoadPayments')}</p>
            ) : payments.length === 0 ? (
              <p className="mt-2 text-sm font-medium text-stone-400">{t('noPaymentRecords')}</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-black text-stone-900">
                        {formatTimestamp(payment.payment_date, locale)}
                      </p>
                      {payment.method ? (
                        <p className="text-xs text-stone-400">{payment.method}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-stone-900">
                        {formatCurrency(payment.amount)}
                      </p>
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-black text-green-700">
                        {getStatusText('COMPLETED')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[32px] bg-white p-8 shadow-sm border-2 border-transparent hover:border-stone-900 transition-all duration-300">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4">
              {t('invoiceHistoryLabel')}
            </p>
            <h2 className="text-2xl font-black text-stone-900 mb-6">{t('allInvoices')}</h2>
            {invoiceError ? (
              <p className="mt-4 text-sm text-stone-400">{t('unableToLoadInvoices')}</p>
            ) : invoices.length === 0 ? (
              <p className="mt-2 text-sm font-medium text-stone-400">{t('noInvoices')}</p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-black text-stone-900">
                        {invoice.invoice_number}
                      </p>
                      <p className="text-xs text-stone-400">
                        {t('issued')} {formatDateOnly(invoice.issue_date, locale)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-stone-900">
                        {formatCurrency(invoice.total_amount)}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-black ${
                          invoice.status === 'PAID'
                            ? 'bg-green-100 text-green-700'
                            : invoice.status === 'OVERDUE'
                            ? 'bg-red-100 text-red-700'
                            : invoice.status === 'UNPAID'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-500'
                        }`}
                      >
                        {getStatusText(invoice.status)}
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