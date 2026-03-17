'use client'

import { useTranslations } from 'next-intl'
import type { ArchetypeKey, Archetype } from '@/data/onboarding-questions'
import { archetypes as defaultArchetypes } from '@/data/onboarding-questions'

interface ArchetypeResultProps {
  archetypeKey: ArchetypeKey
  archetypes?: Record<ArchetypeKey, Archetype>
}

export function ArchetypeResult({ archetypeKey, archetypes = defaultArchetypes }: ArchetypeResultProps) {
  const t = useTranslations('onboarding.archetype')
  const archetype: Archetype = archetypes[archetypeKey]

  return (
    <div className="flex flex-col items-center text-center py-6 px-4">
      {/* Animated reveal */}
      <div
        className="relative w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg"
        style={{ backgroundColor: archetype.bgColor, border: `3px solid ${archetype.color}` }}
      >
        <span className="text-4xl" role="img" aria-label={archetype.name}>
          {archetype.icon}
        </span>

        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ backgroundColor: archetype.color }}
          aria-hidden="true"
        />
      </div>

      {/* Subtitle */}
      <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: archetype.color }}>
        {t('yourArchetypeIs')}
      </p>

      {/* Archetype name */}
      <h2 className="text-3xl font-bold mb-3" style={{ color: 'var(--ink-gray-9)' }}>
        {archetype.name}
      </h2>

      {/* Description */}
      <p className="text-sm max-w-sm leading-relaxed mb-6" style={{ color: 'var(--ink-gray-6)' }}>
        {archetype.description}
      </p>

      {/* Traits */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {archetype.traits.map((trait) => (
          <span
            key={trait}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: archetype.bgColor, color: archetype.textColor }}
          >
            {trait}
          </span>
        ))}
      </div>

      {/* All archetypes preview */}
      <div
        className="w-full max-w-sm rounded-xl p-4 text-left"
        style={{ backgroundColor: 'var(--surface-gray-1)', border: '1px solid var(--outline-gray-1)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-gray-5)' }}>
          {t('allArchetypes')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {Object.values(archetypes).map((a) => (
            <div
              key={a.key}
              className="flex flex-col items-center gap-1 p-2 rounded-lg"
              style={{
                backgroundColor: a.key === archetypeKey ? a.bgColor : 'transparent',
                border: a.key === archetypeKey ? `1.5px solid ${a.color}` : '1.5px solid transparent',
              }}
            >
              <span className="text-lg" role="img" aria-label={a.name}>
                {a.icon}
              </span>
              <span
                className="text-[10px] font-medium text-center leading-tight"
                style={{
                  color: a.key === archetypeKey ? a.textColor : 'var(--ink-gray-5)',
                }}
              >
                {a.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
