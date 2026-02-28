'use client'

// Shared Data tab — renders entity fields in a structured format.
// Shows all the "raw data" fields of an entity in a key-value list.

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Database } from 'lucide-react'

export interface DataField {
  key: string
  label: string
  type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'currency' | 'number' | 'badge'
}

interface DataTabProps {
  fields: DataField[]
  data: Record<string, unknown>
  currency?: string
}

function formatValue(value: unknown, type: DataField['type'], currency = 'BRL'): string {
  if (value === null || value === undefined || value === '') return '\u2014'

  switch (type) {
    case 'date':
      try {
        return format(new Date(value as string), 'dd/MM/yyyy', { locale: ptBR })
      } catch {
        return String(value)
      }
    case 'currency':
      try {
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(Number(value))
      } catch {
        return String(value)
      }
    case 'badge': {
      const badge = value as { label?: string } | null
      return badge?.label ?? '\u2014'
    }
    default:
      return String(value)
  }
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://placeholder.com')
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return url.startsWith('http') ? url : `https://${url}`
    }
    return '#'
  } catch {
    return '#'
  }
}

export function DataTab({ fields, data, currency }: DataTabProps) {
  const hasAnyValue = fields.some((f) => {
    const v = data[f.key]
    return v !== null && v !== undefined && v !== ''
  })

  if (!hasAnyValue) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Database className="w-10 h-10" style={{ color: 'var(--ink-gray-4)' }} />
        <p style={{ color: 'var(--ink-gray-5)', fontSize: '13px', fontWeight: 500 }}>Nenhum dado adicional</p>
      </div>
    )
  }

  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid var(--outline-gray-1)',
        overflow: 'hidden',
      }}
    >
      {fields.map((field, index) => {
        const value = data[field.key]
        const displayValue = formatValue(value, field.type, currency)
        const isLast = index === fields.length - 1

        return (
          <div
            key={field.key}
            className="flex items-center px-4 py-3"
            style={{
              borderBottom: isLast ? 'none' : '1px solid var(--outline-gray-1)',
              backgroundColor: index % 2 === 0 ? 'var(--surface-white)' : 'var(--surface-gray-1)',
            }}
          >
            <span
              className="flex-shrink-0 w-40"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--ink-gray-5)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {field.label}
            </span>
            <span
              className="flex-1 truncate"
              style={{
                fontSize: '13px',
                color: displayValue === '\u2014' ? 'var(--ink-gray-4)' : 'var(--ink-gray-8)',
              }}
            >
              {field.type === 'email' && displayValue !== '\u2014' ? (
                <a
                  href={`mailto:${encodeURIComponent(displayValue)}`}
                  style={{ color: 'var(--ink-blue-3)' }}
                  className="hover:underline"
                >
                  {displayValue}
                </a>
              ) : field.type === 'phone' && displayValue !== '\u2014' ? (
                <a
                  href={`tel:${displayValue.replace(/[^\d+\-() ]/g, '')}`}
                  style={{ color: 'var(--ink-blue-3)' }}
                  className="hover:underline"
                >
                  {displayValue}
                </a>
              ) : field.type === 'url' && displayValue !== '\u2014' ? (
                <a
                  href={sanitizeUrl(displayValue)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--ink-blue-3)' }}
                  className="hover:underline"
                >
                  {displayValue}
                </a>
              ) : (
                displayValue
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
