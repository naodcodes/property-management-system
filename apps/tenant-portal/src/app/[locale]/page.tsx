import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/config';

export default function LocaleHomePage({
  params,
}: {
  params: { locale: string };
}) {
  const prefix = params.locale === defaultLocale ? '' : `/${params.locale}`;
  redirect(`${prefix}/dashboard`);
}
