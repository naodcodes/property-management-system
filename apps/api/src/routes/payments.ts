import { UserRole } from '@property-management/types';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { getPaymentHistory, recordPayment } from '../services/paymentService';
import { supabaseAdmin } from '../lib/supabase';

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

function forbiddenError(): HttpError {
  const error = new Error('Forbidden') as HttpError;
  error.statusCode = 403;
  return error;
}

async function assertTenantSelfAccess(tenantId: string, userId: string): Promise<void> {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('id, user_id')
    .eq('id', tenantId)
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

  if (tenant.user_id !== userId) {
    throw forbiddenError();
  }
}

const recordPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  method: z.string().trim().min(1),
});

const tenantIdParamSchema = z.object({
  id: z.string().uuid('Invalid tenant id'),
});

router.post(
  '/payments',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseOrThrow(recordPaymentSchema, req.body);
      const payment = await recordPayment(body.invoice_id, body.amount, body.method);
      res.status(201).json({ data: payment });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/payments/tenant/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(tenantIdParamSchema, req.params);
    const user = req.user;

    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!isAdmin) {
      if (user.role !== UserRole.TENANT) {
        throw forbiddenError();
      }

      await assertTenantSelfAccess(id, user.id);
    }

    const payments = await getPaymentHistory(id);
    res.json({ data: payments });
  } catch (error) {
    next(error);
  }
});

export { router as paymentsRouter };
