'use client'

import { NextIntlClientProvider } from 'next-intl'
import { useEffect, useState } from 'react'
import { type Locale, defaultLocale, locales } from './config'

const LOCALE_KEY = 'crm-locale'

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored && locales.includes(stored as Locale)) return stored as Locale
  return defaultLocale
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const stored = getStoredLocale()
    setLocale(stored)
    import(`../../messages/${stored}.json`).then((mod) => {
      setMessages(mod.default)
    })
  }, [])

  if (!messages) return <>{children}</>

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  )
}
