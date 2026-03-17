import { useLocale } from 'next-intl'
import { ptBR, enUS } from 'date-fns/locale'

/**
 * Returns the date-fns locale matching the current i18n locale.
 * Usage: const dateLocale = useDateLocale()
 * Then: format(date, 'dd/MM/yyyy', { locale: dateLocale })
 */
export function useDateLocale() {
  const locale = useLocale()
  return locale === 'en' ? enUS : ptBR
}
