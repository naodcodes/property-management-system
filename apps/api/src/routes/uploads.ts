import { UserRole } from '@property-management/types';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getDownloadUrl, getUploadUrl } from '../lib/storage';
import { requireRole } from '../middleware/requireRole';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();
type HttpError = Error & { statusCode: number };

const allowedMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

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

function forbiddenError(): HttpError {
  const error = new Error('Forbidden') as HttpError;
  error.statusCode = 403;
  return error;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_]/g, '')
    .replace(/-+/g, '-');
}

async function getTenantByUserId(userId: string) {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    const dbError = new Error(error.message) as HttpError;
    dbError.statusCode = 500;
    throw dbError;
  }

  if (!tenant) {
    const notFound = new Error('Tenant not found') as HttpError;
    notFound.statusCode = 404;
    throw notFound;
  }

  return tenant;
}

const presignBodySchema = z.object({
  fileName: z.string().trim().min(1),
  mimeType: z.enum(allowedMimeTypes),
  leaseId: z.string().uuid(),
});

const createLeaseDocumentSchema = z.object({
  leaseId: z.string().uuid(),
  storagePath: z.string().trim().min(1),
  originalFilename: z.string().trim().min(1),
  mimeType: z.enum(allowedMimeTypes),
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid document id'),
});

router.post('/uploads/presign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = parseOrThrow(presignBodySchema, req.body);
    const timestamp = Date.now();
    const sanitizedName = sanitizeFileName(body.fileName);
    const storagePath = `leases/${body.leaseId}/${timestamp}-${sanitizedName}`;
    const upload = await getUploadUrl(storagePath, body.mimeType);
    res.json(upload);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/lease-documents',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseOrThrow(createLeaseDocumentSchema, req.body);
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const { data: lease, error: leaseError } = await supabaseAdmin
        .from('leases')
        .select('id, tenant_id')
        .eq('id', body.leaseId)
        .maybeSingle();

      if (leaseError) {
        const dbError = new Error(leaseError.message) as HttpError;
        dbError.statusCode = 500;
        throw dbError;
      }

      if (!lease) {
        const notFound = new Error('Lease not found') as HttpError;
        notFound.statusCode = 404;
        throw notFound;
      }

      const { data: record, error: insertError } = await supabaseAdmin
        .from('lease_documents')
        .insert({
          lease_id: body.leaseId,
          tenant_id: lease.tenant_id,
          s3_key: body.storagePath,
          original_filename: body.originalFilename,
          mime_type: body.mimeType,
          uploaded_by: userId,
        })
        .select('*')
        .single();

      if (insertError) {
        const dbError = new Error(insertError.message) as HttpError;
        dbError.statusCode = 500;
        throw dbError;
      }

      res.status(201).json({ data: record });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/lease-documents/:id/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(idParamSchema, req.params);
      const user = req.user;

      if (!user?.id || !user.role) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const { data: leaseDoc, error: docError } = await supabaseAdmin
        .from('lease_documents')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (docError) {
        const dbError = new Error(docError.message) as HttpError;
        dbError.statusCode = 500;
        throw dbError;
      }

      if (!leaseDoc) {
        const notFound = new Error('Lease document not found') as HttpError;
        notFound.statusCode = 404;
        throw notFound;
      }

      if (user.role === UserRole.TENANT) {
        const tenant = await getTenantByUserId(user.id);
        if (tenant.id !== leaseDoc.tenant_id) {
          throw forbiddenError();
        }
      }

      const { downloadUrl, expiresIn } = await getDownloadUrl(leaseDoc.s3_key);
      res.json({ downloadUrl, expiresIn });
    } catch (error) {
      next(error);
    }
  }
);

export { router as uploadsRouter };
