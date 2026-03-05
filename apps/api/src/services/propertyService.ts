import { supabaseAdmin } from '../lib/supabase';
import { Resend } from 'resend';


type PropertyPayload = {
  name?: string;
  description?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type UnitPayload = {
  unit_code?: string;
  floor?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_meters?: number;
  monthly_rent?: number;
  is_occupied?: boolean;
};

type OnboardPayload = {
  tenant_name: string;
  tenant_email: string;
  lease_start: string;
  monthly_rent: number;
};

const resend = new Resend(process.env.RESEND_API_KEY);

type HttpError = Error & { statusCode: number };

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

export async function getAllProperties(adminUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*, units(*)')
    .eq('created_by', adminUserId)
    .order('created_at', { ascending: false });

  if (error) {
    throw createHttpError(500, error.message);
  }

  return data ?? [];
}

export async function getPropertyById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('*, units(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!data) {
    throw createHttpError(404, 'Property not found');
  }

  return data;
}

export async function createProperty(data: PropertyPayload, adminUserId: string) {
  const requiredFields: Array<keyof PropertyPayload> = [
    'name',
    'address_line_1',
    'city',
    'state',
    'postal_code',
    'country',
  ];

  for (const field of requiredFields) {
    const value = data[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw createHttpError(400, `Missing required field: ${field}`);
    }
  }

  const insertPayload = removeUndefined({
    ...data,
    created_by: adminUserId,
  });

  const { data: created, error } = await supabaseAdmin
    .from('properties')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  return created;
}

export async function updateProperty(id: string, data: PropertyPayload) {
  const updatePayload = removeUndefined(data);

  if (Object.keys(updatePayload).length === 0) {
    throw createHttpError(400, 'At least one property field must be provided');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('properties')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!updated) {
    throw createHttpError(404, 'Property not found');
  }

  return updated;
}

export async function createUnit(propertyId: string, data: UnitPayload) {
  const requiredFields: Array<keyof UnitPayload> = [
    'unit_code',
    'bedrooms',
    'bathrooms',
    'monthly_rent',
    'is_occupied',
  ];

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null) {
      throw createHttpError(400, `Missing required field: ${field}`);
    }
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyError) {
    throw createHttpError(500, propertyError.message);
  }

  if (!property) {
    throw createHttpError(404, 'Property not found');
  }

  const insertPayload = removeUndefined({
    property_id: propertyId,
    ...data,
  });

  const { data: created, error } = await supabaseAdmin
    .from('units')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  return created;
}

export async function updateUnit(id: string, data: UnitPayload) {
  const updatePayload = removeUndefined(data);

  if (Object.keys(updatePayload).length === 0) {
    throw createHttpError(400, 'At least one unit field must be provided');
  }

  const { data: updated, error } = await supabaseAdmin
    .from('units')
    .update(updatePayload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (!updated) {
    throw createHttpError(404, 'Unit not found');
  }

  return updated;
}

export async function onboardTenant(unitId: string, data: OnboardPayload) {
  // 1. Verify Unit Exists
  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('unit_code, property_id, properties(name)')
    .eq('id', unitId)
    .single();

  if (unitError || !unit) {
    throw createHttpError(404, 'Unit not found');
  }

  // 2. Create/Get Tenant 
  // We use upsert on email to avoid duplicates if the tenant was invited before
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .upsert({ 
      full_name: data.tenant_name, 
      email: data.tenant_email,
      status: 'pending' 
    }, { onConflict: 'email' })
    .select()
    .single();

  if (tenantError) throw createHttpError(500, tenantError.message);

  // 3. Create Lease with unique onboarding token
  const onboardingToken = crypto.randomUUID();
  const { error: leaseError } = await supabaseAdmin
    .from('leases')
    .insert({
      unit_id: unitId,
      tenant_id: tenant.id,
      start_date: data.lease_start,
      monthly_rent: data.monthly_rent,
      status: 'pending_signature',
      onboarding_token: onboardingToken
    });

  if (leaseError) throw createHttpError(500, leaseError.message);

  // 4. Update Unit to show it is now spoken for
  await supabaseAdmin
    .from('units')
    .update({ is_occupied: true })
    .eq('id', unitId);

  // 5. Trigger Resend Email
  try {
    const propertyName = (unit.properties as any)?.name || 'your property';
    
    await resend.emails.send({
      from: 'Property Manager <onboarding@yourdomain.com>',
      to: data.tenant_email,
      subject: `Action Required: Your Lease for ${unit.unit_code} at ${propertyName}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Welcome, ${data.tenant_name}!</h2>
          <p>You have been invited to join the tenant portal for <strong>${unit.unit_code}</strong>.</p>
          <p>Please click the button below to review your lease terms and sign the agreement.</p>
          <a href="${process.env.TENANT_PORTAL_URL}/onboard?token=${onboardingToken}" 
             style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
             Review & Sign Lease
          </a>
        </div>
      `
    });
  } catch (emailError) {
    // We don't want to crash the whole process if only the email fails, 
    // but we should log it.
    console.error('Email failed to send:', emailError);
  }

  return { tenantId: tenant.id, unitCode: unit.unit_code };
}