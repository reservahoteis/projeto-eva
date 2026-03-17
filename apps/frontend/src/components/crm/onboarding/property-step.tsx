'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { OnboardingQuestion } from '@/data/onboarding-questions'

// Values that represent "none / not applicable" — mutually exclusive with other options
const NEGATIVE_VALUES = new Set(['nao', 'nenhum', 'nenhuma'])

interface PropertyStepProps {
  questions: OnboardingQuestion[]
  answers: Record<number, string>
  multiAnswers?: Record<number, string[]>
  outroText?: Record<number, string>
  onChange: (questionId: number, value: string) => void
  onMultiChange?: (questionId: number, values: string[]) => void
  onOutroChange?: (questionId: number, text: string) => void
}

export function PropertyStep({
  questions,
  answers,
  multiAnswers = {},
  outroText = {},
  onChange,
  onMultiChange,
  onOutroChange,
}: PropertyStepProps) {
  const t = useTranslations('onboarding.helpers')

  const handleMultiToggle = (questionId: number, value: string) => {
    const current = multiAnswers[questionId] ?? []
    const isNegative = NEGATIVE_VALUES.has(value)

    let next: string[]

    if (isNegative) {
      // Selecting a negative → clear all others, keep only the negative
      next = current.includes(value) ? [] : [value]
    } else {
      // Selecting a positive → remove any negative options first
      const withoutNegatives = current.filter((v) => !NEGATIVE_VALUES.has(v))
      next = withoutNegatives.includes(value)
        ? withoutNegatives.filter((v) => v !== value)
        : [...withoutNegatives, value]
    }

    onMultiChange?.(questionId, next)
    onChange(questionId, next.join(','))
  }

  return (
    <div className="space-y-8">
      {questions.map((question) => {
        const selectedList = multiAnswers[question.id] ?? []
        const negativeSelected =
          question.type === 'multiple' && selectedList.some((v) => NEGATIVE_VALUES.has(v))

        const singleOutroSelected = question.type === 'single' && answers[question.id] === 'outro'
        const multiOutroSelected =
          question.type === 'multiple' && selectedList.includes('outro')
        const showOutroInput = singleOutroSelected || multiOutroSelected

        return (
          <div key={question.id}>
            {/* Question header */}
            <div className="mb-3">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--ink-gray-4)' }}
              >
                {question.theme}
              </span>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--ink-gray-9)' }}>
                {question.question}
              </p>
              {question.type === 'multiple' && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-gray-5)' }}>
                  {t('selectAllThatApply')}
                </p>
              )}
            </div>

            {/* Text input */}
            {question.type === 'text' && (
              <Textarea
                value={answers[question.id] ?? ''}
                onChange={(e) => onChange(question.id, e.target.value)}
                placeholder={question.options[0]?.label || 'Digite sua resposta...'}
                className="text-sm rounded border min-h-[72px] resize-none"
                style={{
                  borderColor: 'var(--outline-gray-2)',
                  backgroundColor: 'var(--surface-white)',
                  color: 'var(--ink-gray-8)',
                }}
              />
            )}

            {/* Single select */}
            {question.type === 'single' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onChange(question.id, option.value)}
                      className={cn(
                        'text-left px-3 py-2.5 rounded-lg border text-sm transition-all duration-150',
                        'hover:border-current focus:outline-none focus-visible:ring-2',
                      )}
                      style={{
                        borderColor: selected ? 'var(--ink-gray-9)' : 'var(--outline-gray-2)',
                        backgroundColor: selected ? 'var(--surface-gray-7)' : 'var(--surface-white)',
                        color: selected ? '#fff' : 'var(--ink-gray-8)',
                      }}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Multiple select */}
            {question.type === 'multiple' && (
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => {
                  const selected = selectedList.includes(option.value)
                  const isNegativeOption = NEGATIVE_VALUES.has(option.value)
                  // Disable positive options when a negative is selected
                  const disabled = negativeSelected && !isNegativeOption

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleMultiToggle(question.id, option.value)}
                      disabled={disabled}
                      className={cn(
                        'px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                        'focus:outline-none focus-visible:ring-2',
                        disabled
                          ? 'cursor-not-allowed opacity-40'
                          : 'hover:border-current',
                      )}
                      style={{
                        borderColor: selected ? 'var(--ink-gray-9)' : 'var(--outline-gray-2)',
                        backgroundColor: selected ? 'var(--surface-gray-7)' : 'var(--surface-white)',
                        color: selected ? '#fff' : 'var(--ink-gray-7)',
                      }}
                      aria-pressed={selected}
                    >
                      {selected && <span className="mr-1" aria-hidden="true">✓</span>}
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* "Outro" free-text input — shown when the "outro" option is selected */}
            {showOutroInput && (
              <div className="mt-3">
                <Input
                  type="text"
                  placeholder={t('outroPlaceholder')}
                  value={outroText[question.id] ?? ''}
                  onChange={(e) => onOutroChange?.(question.id, e.target.value)}
                  className="h-9 text-sm rounded border"
                  style={{
                    borderColor: 'var(--outline-gray-2)',
                    backgroundColor: 'var(--surface-white)',
                    color: 'var(--ink-gray-8)',
                  }}
                  autoFocus
                  maxLength={200}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
