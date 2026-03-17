'use client'

// Faithful to Frappe CRM Avatar component — Espresso design

import type { UserEmbed } from '@/types/crm'

interface UserAvatarProps {
  user?: UserEmbed | null
  label?: string
  image?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '3xl'
  showName?: boolean
  className?: string
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

type SizeStyle = { width: string; height: string; fontSize: string }

const sizeStyleDefault: SizeStyle = { width: '32px', height: '32px', fontSize: '12px' }

const sizeStyles: Record<string, SizeStyle> = {
  xs: { width: '20px', height: '20px', fontSize: '8px' },
  sm: { width: '24px', height: '24px', fontSize: '10px' },
  md: { width: '32px', height: '32px', fontSize: '12px' },
  lg: { width: '40px', height: '40px', fontSize: '14px' },
  xl: { width: '48px', height: '48px', fontSize: '16px' },
  '3xl': { width: '48px', height: '48px', fontSize: '18px' },
}

// Frappe CRM avatar background colors (pastel, from frappe-ui)
const avatarColors = [
  '#E8DEF8', '#D0BCFF', '#F2B8B5', '#FFD8E4',
  '#C2E7FF', '#A8DAB5', '#FFE0B2', '#BCAAA4',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length] ?? '#E8DEF8'
}

export function UserAvatar({
  user,
  label,
  image,
  size = 'md',
  showName = false,
  className,
}: UserAvatarProps) {
  const displayName = label || user?.name || '?'
  const displayImage: string | undefined = image || user?.avatar_url || undefined
  const sizeStyle: SizeStyle = sizeStyles[size] ?? sizeStyleDefault

  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
      {displayImage ? (
        <img
          src={displayImage}
          alt={displayName}
          style={{
            ...sizeStyle,
            borderRadius: '50%',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            ...sizeStyle,
            borderRadius: '50%',
            backgroundColor: getAvatarColor(displayName),
            color: 'var(--ink-gray-8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {getInitials(displayName)}
        </div>
      )}
      {showName && (
        <span
          className="truncate"
          style={{
            fontSize: '14px',
            color: 'var(--ink-gray-8)',
            maxWidth: '120px',
          }}
        >
          {displayName}
        </span>
      )}
    </div>
  )
}

interface MultipleAvatarProps {
  avatars: Array<{ name: string; image?: string; label?: string }>
  size?: 'xs' | 'sm' | 'md'
  className?: string
}

export function MultipleAvatar({ avatars, size = 'sm', className }: MultipleAvatarProps) {
  const max = 3
  const visible = avatars.slice(0, max)
  const remaining = avatars.length - max
  const sizeStyle: SizeStyle = sizeStyles[size] ?? sizeStyleDefault
  const overlap = parseInt(sizeStyle.width) * 0.3

  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((avatar, i) => (
        <div
          key={i}
          style={{
            marginLeft: i > 0 ? `-${overlap}px` : undefined,
            position: 'relative',
            zIndex: visible.length - i,
          }}
        >
          <UserAvatar
            label={avatar.label || avatar.name}
            image={avatar.image}
            size={size}
          />
        </div>
      ))}
      {remaining > 0 && (
        <div
          style={{
            ...sizeStyle,
            marginLeft: `-${overlap}px`,
            borderRadius: '50%',
            backgroundColor: 'var(--surface-gray-3)',
            color: 'var(--ink-gray-6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            position: 'relative',
            zIndex: 0,
          }}
        >
          +{remaining}
        </div>
      )}
    </div>
  )
}
