'use client'

// Faithful recreation of Frappe CRM ViewBreadcrumbs.vue
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
}

export function ViewBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5"
              style={{ color: 'var(--ink-gray-3)' }}
            />
          )}
          {item.icon && (
            <item.icon
              className="mr-1 h-4 w-4"
              style={{ color: 'var(--ink-gray-5)' }}
            />
          )}
          {item.href && i < items.length - 1 ? (
            <Link
              href={item.href}
              className="text-base hover:underline"
              style={{ color: 'var(--ink-gray-5)' }}
            >
              {item.label}
            </Link>
          ) : (
            <span
              className="text-base font-medium"
              style={{
                color:
                  i === items.length - 1
                    ? 'var(--ink-gray-9)'
                    : 'var(--ink-gray-5)',
              }}
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
