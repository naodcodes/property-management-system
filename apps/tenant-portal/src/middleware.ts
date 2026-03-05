import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// This MUST be the default export for Next.js to find it
const middleware = createMiddleware(routing);

export default middleware;

export const config = {
  // Match all pathnames except for
  // - /api (API routes)
  // - /_next (Next.js internals)
  // - /_static (inside /public)
  // - all root files inside /public (e.g. /favicon.ico)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
