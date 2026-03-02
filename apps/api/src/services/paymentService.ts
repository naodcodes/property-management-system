import { InvoiceStatus, PaymentStatus } from '@property-management/types';
import { supabaseAdmin } from '../lib/supabase';

type HttpError = Error & { statusCode: number };

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

export async function recordPayment(invoiceId: string, amount: number, method: string) {
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoiceError) {
    throw createHttpError(500, invoiceError.message);
  }

  if (!invoice) {
    throw createHttpError(404, 'Invoice not found');
  }

  const totalAmount = Number(invoice.total_amount);
  if (amount >= totalAmount && invoice.status !== InvoiceStatus.ISSUED) {
    throw createHttpError(400, 'Invoice can only be marked PAID from ISSUED status');
  }

  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('tenant_id')
    .eq('id', invoice.lease_id)
    .maybeSingle();

  if (leaseError) {
    throw createHttpError(500, leaseError.message);
  }

  if (!lease) {
    throw createHttpError(404, 'Lease not found for invoice');
  }

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from('payments')
    .insert({
      invoice_id: invoiceId,
      tenant_id: lease.tenant_id,
      amount,
      method,
      status: PaymentStatus.COMPLETED,
      payment_date: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (paymentError) {
    throw createHttpError(500, paymentError.message);
  }

  if (amount >= totalAmount) {
    const { error: statusError } = await supabaseAdmin
      .from('invoices')
      .update({ status: InvoiceStatus.PAID })
      .eq('id', invoiceId);

    if (statusError) {
      throw createHttpError(500, statusError.message);
    }
  }

  return payment;
}

export async function getPaymentHistory(tenantId: string) {
  const { data: leases, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('id')
    .eq('tenant_id', tenantId);

  if (leaseError) {
    throw createHttpError(500, leaseError.message);
  }

  const leaseIds = (leases ?? []).map((lease) => lease.id);
  if (leaseIds.length === 0) {
    return [];
  }

  const { data: invoices, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .select('id')
    .in('lease_id', leaseIds);

  if (invoiceError) {
    throw createHttpError(500, invoiceError.message);
  }

  const invoiceIds = (invoices ?? []).map((invoice) => invoice.id);
  if (invoiceIds.length === 0) {
    return [];
  }

  const { data: payments, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .in('invoice_id', invoiceIds)
    .order('created_at', { ascending: false });

  if (paymentError) {
    throw createHttpError(500, paymentError.message);
  }

  return payments ?? [];
}
