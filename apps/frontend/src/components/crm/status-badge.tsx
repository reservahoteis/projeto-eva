'use client'

// Faithful to Frappe CRM Badge component with subtle variant

interface StatusBadgeProps {
  label: string
  color: string
  size?: 'sm' | 'md'
  className?: string
}

type ColorStyle = { bg: string; text: string }

const colorStyleDefault: ColorStyle = { bg: 'var(--surface-gray-2)', text: 'var(--ink-gray-6)' }

const colorStyles: Record<string, ColorStyle> = {
  blue: { bg: 'var(--surface-blue-2)', text: 'var(--ink-blue-3)' },
  green: { bg: 'var(--surface-green-2)', text: 'var(--ink-green-3)' },
  red: { bg: 'var(--surface-red-2)', text: 'var(--ink-red-3)' },
  orange: { bg: 'var(--surface-amber-2)', text: 'var(--ink-amber-3)' },
  yellow: { bg: 'var(--surface-amber-2)', text: 'var(--ink-amber-3)' },
  purple: { bg: '#F0EBFF', text: '#6846E3' },
  pink: { bg: '#FDE8F5', text: '#E34AA6' },
  gray: colorStyleDefault,
  cyan: { bg: '#DDF7FF', text: '#3BBDE5' },
}

export function StatusBadge({ label, color, size = 'sm', className }: StatusBadgeProps) {
  const style: ColorStyle = colorStyles[color] ?? colorStyleDefault

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
        borderRadius: '999px',
        fontSize: size === 'sm' ? '12px' : '13px',
        fontWeight: 500,
        lineHeight: 1.15,
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {label}
    </span>
  )
}
