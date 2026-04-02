import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { defaultLocale, locales } from '@/i18n/config';

const intlMiddleware = createIntlMiddleware(routing);

function resolveLocaleFromPath(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean)[0];
  return locales.includes(segment as (typeof locales)[number]) ? segment : defaultLocale;
}

function isPublicPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname === '/login') return true;
  return locales.some((locale) => pathname === `/${locale}/login`);
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return NextResponse.next();
  }

  const response = intlMiddleware(request);

  if (isPublicPath(pathname)) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const locale = resolveLocaleFromPath(pathname);
    const url = request.nextUrl.clone();
    url.pathname = locale === defaultLocale ? '/login' : `/${locale}/login`;
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
