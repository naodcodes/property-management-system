import { LeaseStatus } from '@property-management/types';
import { supabaseAdmin } from '../lib/supabase';

type HttpError = Error & { statusCode: number };

type CreateLeasePayload = {
  unit_id: string;
  tenant_id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit?: number;
  status?: LeaseStatus;
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

export async function createLease(data: CreateLeasePayload) {
  const leasePayload = removeUndefined({
    tenant_id: data.tenant_id,
    unit_id: data.unit_id,
    property_id: data.property_id,
    start_date: data.start_date,
    end_date: data.end_date,
    monthly_rent: data.monthly_rent,
    security_deposit: data.security_deposit,
    status: data.status ?? LeaseStatus.ACTIVE,
  });

  const { data: createdLease, error: leaseInsertError } = await supabaseAdmin
    .from('leases')
    .insert(leasePayload)
    .select('*')
    .single();

  if (leaseInsertError || !createdLease) {
    throw createHttpError(500, leaseInsertError?.message ?? 'Failed to create lease');
  }

  const { error: unitUpdateError } = await supabaseAdmin
    .from('units')
    .update({ is_occupied: true })
    .eq('id', data.unit_id);

  if (unitUpdateError) {
    await supabaseAdmin.from('leases').delete().eq('id', createdLease.id);
    throw createHttpError(500, unitUpdateError.message);
  }

  const { error: tenantUpdateError } = await supabaseAdmin
    .from('tenants')
    .update({ current_unit_id: data.unit_id })
    .eq('id', data.tenant_id);

  if (tenantUpdateError) {
    await supabaseAdmin.from('leases').delete().eq('id', createdLease.id);
    await supabaseAdmin.from('units').update({ is_occupied: false }).eq('id', data.unit_id);
    throw createHttpError(500, tenantUpdateError.message);
  }

  return createdLease;
}

export async function getLeasesByTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('leases')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    throw createHttpError(500, error.message);
  }

  return data ?? [];
}

export async function getActiveLease(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('leases')
    .select(
      `
      *,
      units(unit_code),
      properties(name, address_line_1, city)
    `
    )
    .eq('tenant_id', tenantId)
    .eq('status', LeaseStatus.ACTIVE)
    .order('start_date', { ascending: false })
    .limit(1);

  if (error) {
    throw createHttpError(500, error.message);
  }

  const lease = data?.[0] ?? null;
  if (!lease) {
    return null;
  }

  const unit = Array.isArray(lease.units) ? lease.units[0] : lease.units;
  const property = Array.isArray(lease.properties) ? lease.properties[0] : lease.properties;
  
  return {
    ...lease,
    unit_code: unit?.unit_code ?? null,
    property_name: property?.name ?? null,
    property_address: property?.address_line_1 ?? null,
    city: property?.city ?? null,
  };
}

export async function updateLeaseStatus(leaseId: string, status: LeaseStatus) {
  const { data, error } = await supabaseAdmin
    .from('leases')
    .update({ status })
    .eq('id', leaseId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!data) {
    throw createHttpError(404, 'Lease not found');
  }

  return data;
}

export async function terminateLease(leaseId: string) {
  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('*')
    .eq('id', leaseId)
    .maybeSingle();

  if (leaseError) {
    throw createHttpError(500, leaseError.message);
  }

  if (!lease) {
    throw createHttpError(404, 'Lease not found');
  }

  const { error: unitError } = await supabaseAdmin
    .from('units')
    .update({ is_occupied: false })
    .eq('id', lease.unit_id);

  if (unitError) {
    throw createHttpError(500, unitError.message);
  }

  const { error: tenantError } = await supabaseAdmin
    .from('tenants')
    .update({ current_unit_id: null })
    .eq('id', lease.tenant_id);

  if (tenantError) {
    await supabaseAdmin.from('units').update({ is_occupied: true }).eq('id', lease.unit_id);
    throw createHttpError(500, tenantError.message);
  }

  const { data: updatedLease, error: terminateError } = await supabaseAdmin
    .from('leases')
    .update({ status: LeaseStatus.TERMINATED })
    .eq('id', leaseId)
    .select('*')
    .maybeSingle();

  if (terminateError) {
    await supabaseAdmin.from('units').update({ is_occupied: true }).eq('id', lease.unit_id);
    await supabaseAdmin
      .from('tenants')
      .update({ current_unit_id: lease.unit_id })
      .eq('id', lease.tenant_id);
    throw createHttpError(500, terminateError.message);
  }

  if (!updatedLease) {
    throw createHttpError(404, 'Lease not found');
  }

  return updatedLease;
}
