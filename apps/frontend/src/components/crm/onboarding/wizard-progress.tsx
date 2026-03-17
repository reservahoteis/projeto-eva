'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface WizardProgressProps {
  currentStep: number
  totalSteps: number
  stepLabels?: string[]
  isSaving?: boolean
  savedAt?: Date | null
}

export function WizardProgress({
  currentStep,
  totalSteps,
  stepLabels,
  isSaving,
  savedAt,
}: WizardProgressProps) {
  const percent = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100)

  return (
    <div
      className="flex-shrink-0 px-6 py-4 border-b"
      style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
    >
      {/* Top row: step counter + save indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--ink-gray-9)' }}>
            Etapa {currentStep} de {totalSteps}
          </span>
          {stepLabels?.[currentStep - 1] && (
            <>
              <span style={{ color: 'var(--outline-gray-3)' }}>·</span>
              <span className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>
                {stepLabels[currentStep - 1]}
              </span>
            </>
          )}
        </div>

        {/* Auto-save indicator */}
        <div className="flex items-center gap-1.5 min-w-[80px] justify-end">
          {isSaving ? (
            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ink-gray-4)' }}>
              <span
                className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--ink-gray-4)' }}
              />
              Salvando...
            </span>
          ) : savedAt ? (
            <span className="text-[11px] flex items-center gap-1" style={{ color: 'var(--ink-green-3)' }}>
              <Check className="w-3 h-3" />
              Salvo
            </span>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--surface-gray-3)' }}
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Progresso: etapa ${currentStep} de ${totalSteps}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: 'var(--ink-gray-9)',
          }}
        />
      </div>

      {/* Step dots (compact, max 15) */}
      <div className="flex items-center gap-1 mt-2 overflow-x-auto">
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepN = i + 1
          const isDone = stepN < currentStep
          const isActive = stepN === currentStep

          return (
            <div
              key={i}
              className={cn(
                'flex-shrink-0 rounded-full transition-all duration-300',
                isActive ? 'w-4 h-1.5' : 'w-1.5 h-1.5',
              )}
              style={{
                backgroundColor: isDone
                  ? 'var(--ink-gray-9)'
                  : isActive
                  ? 'var(--ink-gray-9)'
                  : 'var(--surface-gray-4)',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
