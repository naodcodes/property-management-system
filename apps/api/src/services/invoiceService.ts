import { InvoiceStatus } from '@property-management/types';
import { supabaseAdmin } from '../lib/supabase';

type HttpError = Error & { statusCode: number };

type InvoiceLineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type CreateInvoicePayload = {
  lease_id: string;
  issue_date: string;
  due_date: string;
  status?: InvoiceStatus;
  items: InvoiceLineItemInput[];
};

const invoiceTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.ISSUED],
  [InvoiceStatus.ISSUED]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE],
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.CANCELLED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.CANCELLED]: [],
};

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) {
    return true;
  }

  return invoiceTransitions[from].includes(to);
}

async function generateUniqueInvoiceNumber(): Promise<string> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const prefix = `INV-${year}${month}`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const random = String(Math.floor(1000 + Math.random() * 9000));
    const invoiceNumber = `${prefix}-${random}`;

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();

    if (error) {
      throw createHttpError(500, error.message);
    }

    if (!data) {
      return invoiceNumber;
    }
  }

  throw createHttpError(500, 'Failed to generate unique invoice number');
}

export async function createInvoice(data: CreateInvoicePayload) {
  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('id, tenant_id, status')
    .eq('id', data.lease_id)
    .maybeSingle();

  if (leaseError) {
    throw createHttpError(500, leaseError.message);
  }

  if (!lease) {
    throw createHttpError(404, 'Lease not found');
  }

  if (lease.status !== 'ACTIVE') {
    throw createHttpError(400, 'Cannot create invoice without an active lease');
  }

  const totalAmount = data.items.reduce((sum, item) => sum + item.line_total, 0);
  const invoiceNumber = await generateUniqueInvoiceNumber();
  const invoiceStatus = data.status ?? InvoiceStatus.DRAFT;

  const { data: createdInvoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .insert({
      lease_id: data.lease_id,
      tenant_id: lease.tenant_id,
      invoice_number: invoiceNumber,
      issue_date: data.issue_date,
      due_date: data.due_date,
      status: invoiceStatus,
      total_amount: totalAmount,
    })
    .select('*')
    .single();

  if (invoiceError || !createdInvoice) {
    throw createHttpError(500, invoiceError?.message ?? 'Failed to create invoice');
  }

  const lineItemsPayload = data.items.map((item) => ({
    invoice_id: createdInvoice.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
  }));

  const { data: createdItems, error: lineItemsError } = await supabaseAdmin
    .from('invoice_items')
    .insert(lineItemsPayload)
    .select('*');

  if (lineItemsError) {
    await supabaseAdmin.from('invoices').delete().eq('id', createdInvoice.id);
    throw createHttpError(500, lineItemsError.message);
  }

  return {
    ...createdInvoice,
    items: createdItems ?? [],
  };
}

export async function getInvoicesByTenant(tenantId: string) {
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
    .select('*')
    .in('lease_id', leaseIds)
    .order('created_at', { ascending: false });

  if (invoiceError) {
    throw createHttpError(500, invoiceError.message);
  }

  return invoices ?? [];
}

export async function getInvoiceById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!data) {
    throw createHttpError(404, 'Invoice not found');
  }

  return data;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const { data: existingInvoice, error: invoiceLookupError } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (invoiceLookupError) {
    throw createHttpError(500, invoiceLookupError.message);
  }

  if (!existingInvoice) {
    throw createHttpError(404, 'Invoice not found');
  }

  if (!canTransitionInvoiceStatus(existingInvoice.status as InvoiceStatus, status)) {
    throw createHttpError(400, 'Invalid invoice status transition');
  }


  const { data: updatedInvoice, error: updateError } = await supabaseAdmin
    .from('invoices')
    .update({ status })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (updateError) {
    throw createHttpError(500, updateError.message);
  }

  if (!updatedInvoice) {
    throw createHttpError(404, 'Invoice not found');
  }

  return updatedInvoice;
}

export async function getInvoicesByAdmin(adminId: string) {
  // Use the exact table names from your SQL schema
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(`
      *,
      leases!inner (
        units!inner (
          properties!inner (
            created_by
          )
        )
      )
    `)
    // Notice the dot notation matches the table names exactly
    .eq('leases.units.properties.created_by', adminId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Supabase Query Error:", error);
    throw error;
  }

  return data ?? [];
}
export async function getOverdueInvoices() {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('*')
    .eq('status', InvoiceStatus.ISSUED)
    .lt('due_date', nowIso)
    .order('due_date', { ascending: true });

  if (error) {
    throw createHttpError(500, error.message);
  }

  return data ?? [];
}
