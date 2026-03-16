import { LeaseStatus, MaintenancePriority, MaintenanceStatus } from '@property-management/types';
import { supabaseAdmin } from '../lib/supabase';

type HttpError = Error & { statusCode: number };

type CreateTicketPayload = {
  property_id: string;
  unit_id: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  attachment_key?: string;
};

type TicketFilters = {
  status?: MaintenanceStatus;
  priority?: MaintenancePriority;
  property_id?: string;
};

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function removeUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function createTicket(data: CreateTicketPayload, tenantId: string) {
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) {
    throw createHttpError(500, tenantError.message);
  }

  if (!tenant) {
    throw createHttpError(404, 'Tenant not found');
  }

  const { data: activeLease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('id, unit_id')
    .eq('tenant_id', tenantId)
    .eq('status', LeaseStatus.ACTIVE)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leaseError) {
    throw createHttpError(500, leaseError.message);
  }

  if (!activeLease) {
    throw createHttpError(400, 'Tenant has no active lease');
  }

  if (activeLease.unit_id !== data.unit_id) {
    throw createHttpError(400, 'unit_id is not part of tenant current lease');
  }

  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('id, property_id')
    .eq('id', data.unit_id)
    .maybeSingle();

  if (unitError) {
    throw createHttpError(500, unitError.message);
  }

  if (!unit) {
    throw createHttpError(404, 'Unit not found');
  }

  if (unit.property_id !== data.property_id) {
    throw createHttpError(400, 'property_id does not match unit property');
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('id', data.property_id)
    .maybeSingle();

  if (propertyError) {
    throw createHttpError(500, propertyError.message);
  }

  if (!property) {
    throw createHttpError(404, 'Property not found');
  }

  const { data: createdTicket, error: createError } = await supabaseAdmin
    .from('maintenance_tickets')
    .insert({
      tenant_id: tenantId,
      property_id: data.property_id,
      unit_id: data.unit_id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: MaintenanceStatus.OPEN,
      attachment_key: data.attachment_key,
    })
    .select('*')
    .single();

  if (createError) {
    throw createHttpError(500, createError.message);
  }

  return createdTicket;
}

export async function getTicketsByAdmin(adminId: string, filters: TicketFilters) {
  let query = supabaseAdmin
    .from('maintenance_tickets')
    .select(`
      *,
      property:properties!inner (
        created_by
      )
    `)
    .eq('property.created_by', adminId) // Only tickets for this Admin's properties
    .order('created_at', { ascending: false });

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.property_id) query = query.eq('property_id', filters.property_id);

  const { data, error } = await query;
  if (error) throw createHttpError(500, error.message);

  return data ?? [];
}

export async function getAllTickets(filters: TicketFilters) {
  let query = supabaseAdmin
    .from('maintenance_tickets')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.property_id) {
    query = query.eq('property_id', filters.property_id);
  }

  const { data, error } = await query;
  if (error) {
    throw createHttpError(500, error.message);
  }

  return data ?? [];
}

export async function getTenantTickets(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('maintenance_tickets')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw createHttpError(500, error.message);
  }

  return data ?? [];
}

export async function updateTicketStatus(
  id: string,
  status: MaintenanceStatus,
  assignedTo?: string
) {
  const updatePayload = removeUndefined({
    status,
    assigned_to: assignedTo,
  });

  const { data, error } = await supabaseAdmin
    .from('maintenance_tickets')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!data) {
    throw createHttpError(404, 'Maintenance ticket not found');
  }

  return data;
}

export async function addComment(ticketId: string, userId: string, comment: string) {
  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('maintenance_tickets')
    .select('id')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) {
    throw createHttpError(500, ticketError.message);
  }

  if (!ticket) {
    throw createHttpError(404, 'Maintenance ticket not found');
  }

  const { data, error } = await supabaseAdmin
    .from('maintenance_comments')
    .insert({
      ticket_id: ticketId,
      author_user_id: userId,
      comment,
    })
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  return data;
}

export async function getTicketWithComments(id: string) {
  const { data, error } = await supabaseAdmin
    .from('maintenance_tickets')
    .select('*, maintenance_comments(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!data) {
    throw createHttpError(404, 'Maintenance ticket not found');
  }

  return data;
}
