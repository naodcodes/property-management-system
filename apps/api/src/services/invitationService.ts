import { Resend } from 'resend';
import { supabaseAdmin } from '../lib/supabase';

type HttpError = Error & { statusCode: number };

type InvitationStatus = 'PENDING' | 'ACTIVATED' | 'EXPIRED' | 'CANCELLED';

type CreateInvitationPayload = {
  tenant_name: string;
  tenant_email: string;
  unit_id: string;
  property_id: string;
  monthly_rent: number;
  security_deposit?: number;
  start_date: string;
  end_date: string;
  notes?: string;
  document_key?: string;
};

type InvitationFilters = {
  status?: InvitationStatus;
  property_id?: string;
};

type InvitationEmailPayload = {
  id: string;
  tenant_name: string;
  tenant_email: string;
  unit_id: string;
  property_id: string;
  monthly_rent: number;
  start_date: string;
  end_date: string;
  documents?: Array<{ s3_key: string }> | null;
};

function createHttpError(statusCode: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
}

function createTemporaryPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function splitTenantName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] ?? 'Tenant';
  const last_name = parts.slice(1).join(' ') || 'User';
  return { first_name, last_name };
}

async function getInvitationWithDetails(invitationId: string) {
  const { data, error } = await supabaseAdmin
    .from('lease_invitations')
    .select('*, units(unit_code), properties(name)')
    .eq('id', invitationId)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }
  if (!data) {
    throw createHttpError(404, 'Invitation not found');
  }
  return data;
}

async function ensureUnitNotOccupied(unitId: string) {
  const { data: unit, error } = await supabaseAdmin
    .from('units')
    .select('id, is_occupied')
    .eq('id', unitId)
    .maybeSingle();

  if (error) {
    throw createHttpError(500, error.message);
  }
  if (!unit) {
    throw createHttpError(404, 'Unit not found');
  }
  if (unit.is_occupied) {
    throw createHttpError(400, 'Unit is already occupied');
  }
}

export async function createInvitation(payload: CreateInvitationPayload, adminUserId: string) {
  await ensureUnitNotOccupied(payload.unit_id);

  const { document_key, ...invitationData } = payload;

  const { data: existingPending, error: existingError } = await supabaseAdmin
    .from('lease_invitations')
    .select('id')
    .eq('unit_id', invitationData.unit_id)
    .eq('status', 'PENDING')
    .limit(1);

  if (existingError) {
    throw createHttpError(500, existingError.message);
  }
  if ((existingPending ?? []).length > 0) {
    throw createHttpError(400, 'A pending invitation already exists for this unit');
  }

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const { data: invitation, error } = await supabaseAdmin
    .from('lease_invitations')
    .insert({
      ...invitationData,
      status: 'PENDING',
      created_by: adminUserId,
      expires_at: expiresAt,
    })
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  if (document_key) {
    const originalFilename = document_key.split('/').pop() || document_key;
    const { error: documentError } = await supabaseAdmin.from('lease_documents').insert({
      invitation_id: invitation.id,
      lease_id: null,
      tenant_id: null,
      s3_key: document_key,
      original_filename: originalFilename,
      mime_type: 'application/pdf',
      uploaded_by: adminUserId,
    });

    if (documentError) {
      await supabaseAdmin.from('lease_invitations').delete().eq('id', invitation.id);
      throw createHttpError(500, documentError.message);
    }
  }

  return invitation;
}

export async function getInvitations(filters: InvitationFilters) {
  let query = supabaseAdmin
    .from('lease_invitations')
    .select('*, units(unit_code), properties(name)')
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }
  if (filters.property_id) {
    query = query.eq('property_id', filters.property_id);
  }

  const { data, error } = await query;
  if (error) {
    throw createHttpError(500, error.message);
  }

  return (data ?? []).map((row) => ({
    ...row,
    unit_code: row.units?.unit_code ?? null,
    property_name: row.properties?.name ?? null,
  }));
}

export async function getInvitationById(id: string) {
  const data = await getInvitationWithDetails(id);
  const { data: documents, error } = await supabaseAdmin
    .from('lease_documents')
    .select('id, s3_key, original_filename, mime_type, created_at')
    .eq('invitation_id', id);

  if (error) {
    throw createHttpError(500, error.message);
  }

  return {
    ...data,
    unit_code: data.units?.unit_code ?? null,
    property_name: data.properties?.name ?? null,
    documents: documents ?? [],
  };
}

export async function cancelInvitation(id: string) {
  const invitation = await getInvitationWithDetails(id);

  if (invitation.status !== 'PENDING') {
    throw createHttpError(400, 'Only PENDING invitations can be cancelled');
  }

  const { data, error } = await supabaseAdmin
    .from('lease_invitations')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }
  return data;
}

export async function appendInvitationDocument(
  id: string,
  documentKey: string,
  adminUserId: string
) {
  await getInvitationWithDetails(id);
  const originalFilename = documentKey.split('/').pop() || documentKey;

  const { data, error } = await supabaseAdmin
    .from('lease_documents')
    .insert({
      invitation_id: id,
      lease_id: null,
      tenant_id: null,
      s3_key: documentKey,
      original_filename: originalFilename,
      mime_type: 'application/pdf',
      uploaded_by: adminUserId,
    })
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, error.message);
  }

  return data;
}

export async function activateInvitation(
  id: string,
  signedLeaseKey: string,
  adminUserId: string
) {
  const invitation = await getInvitationWithDetails(id);

  if (invitation.status !== 'PENDING') {
    throw createHttpError(400, 'Invitation is not pending');
  }

  await ensureUnitNotOccupied(invitation.unit_id);

  const temporaryPassword = createTemporaryPassword(12);
  const { first_name, last_name } = splitTenantName(invitation.tenant_name);

  let authUserId: string | null = null;
  let tenantId: string | null = null;
  let leaseId: string | null = null;
  let unitOccupiedUpdated = false;
  let tenantCurrentUnitUpdated = false;

  try {
    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invitation.tenant_email,
      password: temporaryPassword,
      email_confirm: true,
      app_metadata: { role: 'TENANT' },
      user_metadata: { first_name, last_name },
    });

    if (authError || !authResult.user) {
      throw createHttpError(500, authError?.message ?? 'Failed to create auth user');
    }
    authUserId = authResult.user.id;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        user_id: authUserId,
        phone: null,
        current_unit_id: null,
      })
      .select('*')
      .single();

    if (tenantError || !tenant) {
      throw createHttpError(500, tenantError?.message ?? 'Failed to create tenant');
    }
    tenantId = tenant.id;

    const { data: lease, error: leaseError } = await supabaseAdmin
      .from('leases')
      .insert({
        tenant_id: tenantId,
        unit_id: invitation.unit_id,
        property_id: invitation.property_id,
        start_date: invitation.start_date,
        end_date: invitation.end_date,
        monthly_rent: invitation.monthly_rent,
        security_deposit: invitation.security_deposit,
        status: 'ACTIVE',
      })
      .select('*')
      .single();

    if (leaseError || !lease) {
      throw createHttpError(500, leaseError?.message ?? 'Failed to create lease');
    }
    leaseId = lease.id;

    const { error: updateDocumentsError } = await supabaseAdmin
      .from('lease_documents')
      .update({
        lease_id: leaseId,
        tenant_id: tenantId,
      })
      .eq('invitation_id', id)
      .is('lease_id', null);

    if (updateDocumentsError) {
      throw createHttpError(500, updateDocumentsError.message);
    }

    const signedOriginalFilename = signedLeaseKey.split('/').pop() || signedLeaseKey;
    const { error: insertSignedError } = await supabaseAdmin.from('lease_documents').insert({
      invitation_id: id,
      lease_id: leaseId,
      tenant_id: tenantId,
      s3_key: signedLeaseKey,
      original_filename: signedOriginalFilename,
      mime_type: 'application/pdf',
      uploaded_by: adminUserId,
    });

    if (insertSignedError) {
      throw createHttpError(500, insertSignedError.message);
    }

    const { error: unitError } = await supabaseAdmin
      .from('units')
      .update({ is_occupied: true })
      .eq('id', invitation.unit_id);
    if (unitError) {
      throw createHttpError(500, unitError.message);
    }
    unitOccupiedUpdated = true;

    const { error: tenantCurrentUnitError } = await supabaseAdmin
      .from('tenants')
      .update({ current_unit_id: invitation.unit_id })
      .eq('id', tenantId);
    if (tenantCurrentUnitError) {
      throw createHttpError(500, tenantCurrentUnitError.message);
    }
    tenantCurrentUnitUpdated = true;

    const { error: invitationUpdateError } = await supabaseAdmin
      .from('lease_invitations')
      .update({
        status: 'ACTIVATED',
        activated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (invitationUpdateError) {
      throw createHttpError(500, invitationUpdateError.message);
    }

    return { tenant, lease, temporaryPassword, tenantEmail: invitation.tenant_email };
  } catch (error) {
    if (tenantCurrentUnitUpdated && tenantId) {
      await supabaseAdmin.from('tenants').update({ current_unit_id: null }).eq('id', tenantId);
    }
    if (unitOccupiedUpdated) {
      await supabaseAdmin.from('units').update({ is_occupied: false }).eq('id', invitation.unit_id);
    }
    if (leaseId) {
      await supabaseAdmin.from('lease_documents').delete().eq('lease_id', leaseId);
    }
    if (leaseId) {
      await supabaseAdmin.from('leases').delete().eq('id', leaseId);
    }
    if (tenantId) {
      await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
    }
    if (authUserId) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
    }

    throw error;
  }
}

export async function sendInvitationEmail(invitation: InvitationEmailPayload) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('unit_code')
    .eq('id', invitation.unit_id)
    .maybeSingle();
  if (unitError) {
    throw createHttpError(500, unitError.message);
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from('properties')
    .select('name')
    .eq('id', invitation.property_id)
    .maybeSingle();
  if (propertyError) {
    throw createHttpError(500, propertyError.message);
  }

  const documentsList = Array.isArray(invitation.documents) ? invitation.documents : [];
  const docsHtml =
    documentsList.length > 0
      ? `<ul>${documentsList.map((doc) => `<li>${doc.s3_key}</li>`).join('')}</ul>`
      : '<p>No documents attached yet.</p>';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Betoch</h2>
      <p>Hello ${invitation.tenant_name},</p>
      <p>You have been invited to review your lease.</p>
      <p><strong>Property:</strong> ${property?.name ?? invitation.property_id}</p>
      <p><strong>Unit:</strong> ${unit?.unit_code ?? invitation.unit_id}</p>
      <p><strong>Lease dates:</strong> ${invitation.start_date} to ${invitation.end_date}</p>
      <p><strong>Monthly rent:</strong> ${invitation.monthly_rent}</p>
      <p>Please review the attached lease documents. Your landlord will contact you to discuss next steps.</p>
      <h4>Documents</h4>
      ${docsHtml}
      <p style="margin-top:24px">- Betoch Team</p>
    </div>
  `;

  if (!resendApiKey) {
    console.log('[INVITATION EMAIL PREVIEW]', {
      to: invitation.tenant_email,
      subject: 'You have been invited to review your lease - Betoch',
      html,
    });
    return;
  }

  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: invitation.tenant_email,
    subject: 'You have been invited to review your lease - Betoch',
    html,
  });
  if (error) {
    throw createHttpError(500, error.message);
  }
}

export async function sendActivationWelcomeEmail(params: {
  tenantEmail: string;
  temporaryPassword: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const tenantPortalUrl = process.env.TENANT_PORTAL_URL || 'http://localhost:3002';

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
      <h2>Welcome to Betoch!</h2>
      <p>Your lease is now active.</p>
      <p><strong>Login URL:</strong> ${tenantPortalUrl}</p>
      <p><strong>Email:</strong> ${params.tenantEmail}</p>
      <p><strong>Temporary password:</strong> ${params.temporaryPassword}</p>
      <p>Please log in and change your password.</p>
    </div>
  `;

  if (!resendApiKey) {
    console.log('[WELCOME EMAIL PREVIEW]', {
      to: params.tenantEmail,
      subject: 'Welcome to Betoch! Your lease is now active.',
      html,
    });
    return;
  }

  const resend = new Resend(resendApiKey);
  const { error } = await resend.emails.send({
    from: fromEmail,
    to: params.tenantEmail,
    subject: 'Welcome to Betoch! Your lease is now active.',
    html,
  });
  if (error) {
    throw createHttpError(500, error.message);
  }
}
