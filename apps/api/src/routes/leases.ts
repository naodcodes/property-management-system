import { Router, Request, Response, NextFunction } from 'express';
import { LeaseStatus, UserRole } from '@property-management/types';
import { z } from 'zod';
import {
  createLease,
  getActiveLease,
  getLeasesByTenant,
  terminateLease,
  updateLeaseStatus,
} from '../services/leaseService';
import { requireRole } from '../middleware/requireRole';
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
    const err = new Error(error.message) as HttpError;
    err.statusCode = 500;
    throw err;
  }

  if (!tenant) {
    const err = new Error('Tenant not found') as HttpError;
    err.statusCode = 404;
    throw err;
  }

  if (tenant.user_id !== userId) {
    throw forbiddenError();
  }
}

const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const tenantIdParamSchema = z.object({
  tenantId: z.string().uuid('Invalid tenant id'),
});

const createLeaseSchema = z.object({
  unit_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string(),
  monthly_rent: z.number().nonnegative(),
  security_deposit: z.number().nonnegative().optional(),
  status: z.nativeEnum(LeaseStatus).optional(),
});

const leaseStatusSchema = z.object({
  status: z.nativeEnum(LeaseStatus),
});

router.post(
  '/leases',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseOrThrow(createLeaseSchema, req.body);
      const lease = await createLease(body);
      res.status(201).json({ data: lease });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/leases/mine',
  requireRole(UserRole.TENANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (tenantError) {
        const err = new Error(tenantError.message) as HttpError;
        err.statusCode = 500;
        throw err;
      }

      if (!tenant) {
        res.status(404).json({ error: 'Tenant not found', status: 404 });
        return;
      }

      const activeLease = await getActiveLease(tenant.id);
      res.json({ data: activeLease ?? null });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/tenants/:tenantId/leases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = parseOrThrow(tenantIdParamSchema, req.params);
    const user = req.user;
    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!isAdmin) {
      await assertTenantSelfAccess(tenantId, user.id);
    }

    const leases = await getLeasesByTenant(tenantId);
    res.json({ data: leases });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/tenants/:tenantId/leases/active',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId } = parseOrThrow(tenantIdParamSchema, req.params);
      const user = req.user;
      if (!user?.id || !user.role) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
      if (!isAdmin) {
        await assertTenantSelfAccess(tenantId, user.id);
      }

      const activeLease = await getActiveLease(tenantId);
      res.json({ data: activeLease });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/leases/:id/status',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(idParamSchema, req.params);
      const { status } = parseOrThrow(leaseStatusSchema, req.body);
      const lease = await updateLeaseStatus(id, status);
      res.json({ data: lease });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/leases/:id/terminate',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(idParamSchema, req.params);
      const lease = await terminateLease(id);
      res.json({ data: lease });
    } catch (error) {
      next(error);
    }
  }
);

export { router as leasesRouter };
