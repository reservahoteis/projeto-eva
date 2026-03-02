'use client'

import { useState, useEffect } from 'react'
import { type Locale, locales, localeNames, defaultLocale } from '@/i18n/config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe } from 'lucide-react'

const LOCALE_KEY = 'crm-locale'

export function LanguageSwitcher({ collapsed }: { collapsed?: boolean }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale)

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored && locales.includes(stored as Locale)) {
      setLocaleState(stored as Locale)
    }
  }, [])

  const switchLocale = (newLocale: Locale) => {
    localStorage.setItem(LOCALE_KEY, newLocale)
    document.documentElement.lang = newLocale
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-gray-100"
          style={{ color: 'var(--ink-gray-6)' }}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <span className="truncate">{localeNames[locale]}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={locale === loc ? 'font-semibold' : ''}
          >
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
