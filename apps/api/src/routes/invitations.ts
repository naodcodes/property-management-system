import { UserRole } from '@property-management/types';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { supabaseAdmin } from '../lib/supabase';
import {
  activateInvitation,
  appendInvitationDocument,
  cancelInvitation,
  createInvitation,
  getInvitationById,
  getInvitations,
  sendActivationWelcomeEmail,
  sendInvitationEmail,
} from '../services/invitationService';

const router = Router();
type HttpError = Error & { statusCode: number };

function validationError(message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.statusCode = 400;
  return error;
}

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw validationError(result.error.issues.map((issue) => issue.message).join(', '));
  }
  return result.data;
}

const invitationStatus = z.enum(['PENDING', 'ACTIVATED', 'EXPIRED', 'CANCELLED']);

const createInvitationSchema = z.object({
  tenant_name: z.string().trim().min(1),
  tenant_email: z.string().email(),
  unit_id: z.string().uuid(),
  property_id: z.string().uuid(),
  monthly_rent: z.number().nonnegative(),
  security_deposit: z.number().nonnegative().optional(),
  start_date: z.string(),
  end_date: z.string(),
  notes: z.string().trim().min(1).optional(),
  document_key: z.string().trim().min(1).optional(),
});

const invitationFiltersSchema = z.object({
  status: invitationStatus.optional(),
  property_id: z.string().uuid().optional(),
});

const invitationIdParamSchema = z.object({
  id: z.string().uuid(),
});

const activateInvitationSchema = z.object({
  signed_lease_key: z.string().trim().min(1),
});

const appendDocumentSchema = z.object({
  document_key: z.string().trim().min(1),
});

router.post(
  '/invitations',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseOrThrow(createInvitationSchema, req.body);
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const invitation = await createInvitation(body, adminUserId);
      const { data: documents, error: documentsError } = await supabaseAdmin
        .from('lease_documents')
        .select('s3_key')
        .eq('invitation_id', invitation.id);

      if (documentsError) {
        const err = new Error(documentsError.message) as HttpError;
        err.statusCode = 500;
        throw err;
      }

      await sendInvitationEmail({ ...invitation, documents: documents ?? [] });
      res.status(201).json({ data: invitation });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/invitations',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = parseOrThrow(invitationFiltersSchema, req.query);
      const invitations = await getInvitations(filters);
      res.json({ data: invitations });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/invitations/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(invitationIdParamSchema, req.params);
      const invitation = await getInvitationById(id);
      res.json({ data: invitation });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/invitations/:id/cancel',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(invitationIdParamSchema, req.params);
      const invitation = await cancelInvitation(id);
      res.json({ data: invitation });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/invitations/:id/activate',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(invitationIdParamSchema, req.params);
      const { signed_lease_key } = parseOrThrow(activateInvitationSchema, req.body);
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const result = await activateInvitation(id, signed_lease_key, adminUserId);
      await sendActivationWelcomeEmail({
        tenantEmail: result.tenantEmail,
        temporaryPassword: result.temporaryPassword,
      });

      res.json({
        tenant: result.tenant,
        lease: result.lease,
        message: 'Tenant activated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/invitations/:id/documents',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(invitationIdParamSchema, req.params);
      const { document_key } = parseOrThrow(appendDocumentSchema, req.body);
      const adminUserId = req.user?.id;
      if (!adminUserId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }
      const document = await appendInvitationDocument(id, document_key, adminUserId);
      res.json({ data: document });
    } catch (error) {
      next(error);
    }
  }
);

export { router as invitationsRouter };
