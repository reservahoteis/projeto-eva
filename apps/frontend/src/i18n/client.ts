'use client'

import { useCallback, useEffect, useState } from 'react'
import { type Locale, defaultLocale, locales } from './config'

const LOCALE_KEY = 'crm-locale'

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored && locales.includes(stored as Locale)) return stored as Locale
  return defaultLocale
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem(LOCALE_KEY, locale)
  document.documentElement.lang = locale
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  useEffect(() => {
    setLocaleState(getStoredLocale())
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setStoredLocale(newLocale)
    setLocaleState(newLocale)
    window.location.reload()
  }, [])

  return { locale, setLocale }
}
