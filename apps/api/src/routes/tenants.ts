import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@property-management/types';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import {
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenantProfile,
} from '../services/tenantService';
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
  id: z.string().uuid('Invalid tenant id'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

const createTenantSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().trim().min(1),
  last_name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  emergency_contact_name: z.string().trim().min(1).optional(),
  emergency_contact_phone: z.string().trim().min(1).optional(),
});

const tenantProfilePatchSchema = z
  .object({
    phone: z.string().trim().min(1).optional(),
    emergency_contact_name: z.string().trim().min(1).optional(),
    emergency_contact_phone: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one profile field must be provided');

router.get(
  '/tenants',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit } = parseOrThrow(paginationSchema, req.query);
      const tenants = await getAllTenants(page ?? 1, limit ?? 10);
      res.json(tenants);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/tenants/me',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TENANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const { data, error } = await supabaseAdmin
        .from('tenants')
        .select(
          `
          id,
          user_id,
          phone,
          emergency_contact_name,
          emergency_contact_phone,
          current_unit_id,
          created_at,
          updated_at,
          units(
            unit_code,
            properties(
              name,
              address_line_1,
              city
            )
          )
        `
        )
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        const err = new Error(error.message) as HttpError;
        err.statusCode = 500;
        throw err;
      }

      if (!data) {
        res.status(404).json({ error: 'Tenant profile not found', status: 404 });
        return;
      }

      const unit = Array.isArray(data.units) ? data.units[0] : data.units;
      const property = Array.isArray(unit?.properties) ? unit?.properties[0] : unit?.properties;

      res.json({
        data: {
          id: data.id,
          user_id: data.user_id,
          phone: data.phone,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          current_unit_id: data.current_unit_id,
          created_at: data.created_at,
          updated_at: data.updated_at,
          unit_code: unit?.unit_code ?? null,
          property_name: property?.name ?? null,
          property_address: property?.address_line_1 ?? null,
          city: property?.city ?? null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/tenants/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const user = req.user;
    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
    if (!isAdmin) {
      await assertTenantSelfAccess(id, user.id);
    }

    const tenant = await getTenantById(id);
    res.json({ data: tenant });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/tenants',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = parseOrThrow(createTenantSchema, req.body);
      const tenant = await createTenant(body);
      res.status(201).json({ data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/tenants/:id/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const body = parseOrThrow(tenantProfilePatchSchema, req.body);
    const user = req.user;

    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    if (user.role !== UserRole.TENANT) {
      throw forbiddenError();
    }

    await assertTenantSelfAccess(id, user.id);
    const updatedTenant = await updateTenantProfile(id, body);
    res.json({ data: updatedTenant });
  } catch (error) {
    next(error);
  }
});

export { router as tenantsRouter };
