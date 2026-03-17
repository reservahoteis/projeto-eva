'use client'

// Faithful to Frappe CRM dashboard stat cards — Espresso design
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  subtitle?: string
  loading?: boolean
  className?: string
  color?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  loading,
  className,
}: StatCardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--ink-gray-5)',
              fontWeight: 500,
              marginBottom: '2px',
            }}
          >
            {title}
          </p>
          {loading ? (
            <div
              style={{
                height: '32px',
                width: '80px',
                backgroundColor: 'var(--surface-gray-2)',
                borderRadius: '4px',
                marginTop: '4px',
              }}
              className="animate-pulse"
            />
          ) : (
            <p
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--ink-gray-9)',
              }}
            >
              {value}
            </p>
          )}
          {subtitle && (
            <p style={{ fontSize: '12px', color: 'var(--ink-gray-4)', marginTop: '2px' }}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <Icon
            className="h-5 w-5"
            style={{ color: 'var(--ink-gray-4)' }}
          />
        )}
      </div>
    </div>
  )
}
