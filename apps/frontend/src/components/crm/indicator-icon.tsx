'use client'

// Faithful recreation of Frappe CRM IndicatorIcon
// A simple colored dot used for status indicators

interface IndicatorIconProps {
  color?: string
  className?: string
}

const colorMap: Record<string, string> = {
  gray: 'var(--ink-gray-4)',
  blue: 'var(--ink-blue-3)',
  green: 'var(--ink-green-3)',
  red: 'var(--ink-red-3)',
  orange: 'var(--ink-amber-3)',
  yellow: '#E79913',
  purple: '#6846E3',
  pink: '#E34AA6',
  cyan: '#3BBDE5',
}

export function IndicatorIcon({ color = 'gray', className }: IndicatorIconProps) {
  const resolvedColor = colorMap[color] || color

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: resolvedColor,
        flexShrink: 0,
      }}
    />
  )
}
