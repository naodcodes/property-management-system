import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { invoicesRouter } from './routes/invoices';
import { invitationsRouter } from './routes/invitations';
import { leasesRouter } from './routes/leases';
import { maintenanceRouter } from './routes/maintenance';
import { paymentsRouter } from './routes/payments';
import { propertiesRouter } from './routes/properties';
import { tenantsRouter } from './routes/tenants';
import { uploadsRouter } from './routes/uploads';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    credentials: true,
  })
);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', authMiddleware, propertiesRouter);
app.use('/api', authMiddleware, tenantsRouter);
app.use('/api', authMiddleware, leasesRouter);
app.use('/api', authMiddleware, invoicesRouter);
app.use('/api', authMiddleware, paymentsRouter);
app.use('/api', authMiddleware, maintenanceRouter);
app.use('/api', authMiddleware, uploadsRouter);
app.use('/api', authMiddleware, invitationsRouter);

app.use(errorHandler);

const port = Number(process.env.PORT) || 3001;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
