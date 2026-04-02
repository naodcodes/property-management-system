import { MaintenancePriority, MaintenanceStatus, UserRole } from '@property-management/types';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware/requireRole';
import { supabaseAdmin } from '../lib/supabase';
import {
  addComment,
  createTicket,
  getAllTickets,
  getTenantTickets,
  getTicketWithComments,
  getTicketsByAdmin,
  updateTicketStatus,
} from '../services/maintenanceService';

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

async function assertTicketAccess(ticketId: string, user: NonNullable<Request['user']>) {
  const { data: ticket, error } = await supabaseAdmin
    .from('maintenance_tickets')
    .select('id, tenant_id')
    .eq('id', ticketId)
    .maybeSingle();

  if (error) {
    const dbError = new Error(error.message) as HttpError;
    dbError.statusCode = 500;
    throw dbError;
  }

  if (!ticket) {
    const notFound = new Error('Maintenance ticket not found') as HttpError;
    notFound.statusCode = 404;
    throw notFound;
  }

  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    return ticket;
  }

  if (user.role !== UserRole.TENANT) {
    throw forbiddenError();
  }

  const tenant = await getTenantByUserId(user.id);
  if (ticket.tenant_id !== tenant.id) {
    throw forbiddenError();
  }

  return ticket;
}

const idParamSchema = z.object({
  id: z.string().uuid('Invalid ticket id'),
});

const createTicketSchema = z.object({
  property_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  priority: z.nativeEnum(MaintenancePriority),
  attachment_key: z.string().trim().min(1).optional(),
});

const ticketFilterSchema = z.object({
  status: z.nativeEnum(MaintenanceStatus).optional(),
  priority: z.nativeEnum(MaintenancePriority).optional(),
  property_id: z.string().uuid().optional(),
});

const updateTicketSchema = z
  .object({
    status: z.nativeEnum(MaintenanceStatus),
    assigned_to: z.string().uuid().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const addCommentSchema = z.object({
  comment: z.string().trim().min(1),
});

router.post(
  '/maintenance',
  requireRole(UserRole.TENANT),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user?.id) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const body = parseOrThrow(createTicketSchema, req.body);
      const tenant = await getTenantByUserId(user.id);
      const ticket = await createTicket(body, tenant.id);
      res.status(201).json({ data: ticket });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/maintenance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user?.id || !user.role) {
        res.status(401).json({ error: 'Unauthorized', status: 401 });
        return;
      }

      const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
      if (isAdmin) {
        const filters = parseOrThrow(ticketFilterSchema, req.query);
        const tickets = await getAllTickets(filters);
        res.json({ data: tickets });
        return;
      }

      if (user.role !== UserRole.TENANT) {
        throw forbiddenError();
      }

      const tenant = await getTenantByUserId(user.id);
      const tickets = await getTenantTickets(tenant.id);
      res.json({ data: tickets });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/maintenance/mine', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    if (user.role !== UserRole.TENANT) {
      throw forbiddenError();
    }

    const tenant = await getTenantByUserId(user.id);
    const tickets = await getTenantTickets(tenant.id);
    res.json({ data: tickets });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/maintenance/:id',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parseOrThrow(idParamSchema, req.params);
      const body = parseOrThrow(updateTicketSchema, req.body);
      const ticket = await updateTicketStatus(id, body.status, body.assigned_to);
      res.json({ data: ticket });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/maintenance/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const { comment } = parseOrThrow(addCommentSchema, req.body);
    const user = req.user;

    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    await assertTicketAccess(id, user);
    const createdComment = await addComment(id, user.id, comment);
    res.status(201).json({ data: createdComment });
  } catch (error) {
    next(error);
  }
});

router.get('/maintenance/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(idParamSchema, req.params);
    const user = req.user;
    if (!user?.id || !user.role) {
      res.status(401).json({ error: 'Unauthorized', status: 401 });
      return;
    }

    await assertTicketAccess(id, user);
    const ticket = await getTicketWithComments(id);
    res.json({ data: ticket });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/maintenance',
  requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user!; // requireRole ensures user exists
      const filters = parseOrThrow(ticketFilterSchema, req.query);
      
      // Call the new admin-specific filter
      const tickets = await getTicketsByAdmin(user.id, filters);
      
      res.json({ data: tickets });
    } catch (error) {
      next(error);
    }
  }
);

export { router as maintenanceRouter };
