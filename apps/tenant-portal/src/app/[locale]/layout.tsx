import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { locales } from '@/i18n/config';
import TenantShell from '@/components/layout/TenantShell';

export default async function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  if (!locales.includes(locale)) notFound();
  return <TenantShell>{children}</TenantShell>;
}
