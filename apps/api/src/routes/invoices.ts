import { InvoiceStatus, UserRole } from '@property-management/types';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import {
  createInvoice,
  getInvoiceById,
  getInvoicesByTenant,
  getOverdueInvoices,
  updateInvoiceStatus,
} from '../services/invoiceService';
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

async function assertInvoiceTenantAccess(invoiceId: string, tenantId: string): Promise<void> {
  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('id, lease_id')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error) {
    const dbError = new Error(error.message) as HttpError;
    dbError.statusCode = 500;
    throw dbError;
  }

  if (!invoice) {
    const notFound = new Error('Invoice not found') as HttpError;
    notFound.statusCode = 404;
    throw notFound;
  }

  const { data: lease, error: leaseError } = await supabaseAdmin
    .from('leases')
    .select('tenant_id')
    .eq('id', invoice.lease_id)
    .maybeSingle();

  if (leaseError) {
    const dbError = new Error(leaseError.message) as HttpError;
    dbError.statusCode = 500;
    throw dbError;
  }

  if (!lease || lease.tenant_id !== tenantId) {
    throw forbiddenError();
  }
}

const idParamSchema = z.object({
  id: z.string().uuid('Invalid invoice id'),
});

const createInvoiceSchema = z.object({
  lease_id: z.string().uuid(),
  issue_date: z.string().datetime(),
  due_date: z.string().datetime(),
  status: z.nativeEnum(InvoiceStatus).optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1),
        quantity: z.number().positive(),
        unit_price: z.number().nonnegative(),
        line_total: z.number().nonnegative(),
      })
    )
    .min(1),
});

const updateInvoiceStatusSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

router.get('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      const invoices = await getOverdueInvoices();
      res.json({ data: invoices });
      return;
    }

    if (user.role === UserRole.TENANT) {
      const tenant = await getTenantByUserId(user.id);
      const invoices = await getInvoicesByTenant(tenant.id);
      res.json({ data: invoices });
      return;
    }

    throw forbiddenError();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/invoices/mine',
  requireRole(UserRole.TENANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const tenant = await getTenantByUserId(userId);
      const { data, error } = await supabaseAdmin
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('due_date', { ascending: false });

      if (error) {
        const dbError = new Error(error.message) as HttpError;
        dbError.statusCode = 500;
        throw dbError;
      }

      res.json({ data: data ?? [] });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const user = req.user;

    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    if (user.role === UserRole.TENANT) {
      const tenant = await getTenantByUserId(user.id);
      await assertInvoiceTenantAccess(id, tenant.id);
    }

    const invoice = await getInvoiceById(id);
    res.json({ data: invoice });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/invoices',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseOrThrow(createInvoiceSchema, req.body);
      const invoice = await createInvoice(body);
      res.status(201).json({ data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/invoices/:id/status',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(idParamSchema, req.params);
      const { status } = parseOrThrow(updateInvoiceStatusSchema, req.body);
      const invoice = await updateInvoiceStatus(id, status);
      res.json({ data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

export { router as invoicesRouter };
