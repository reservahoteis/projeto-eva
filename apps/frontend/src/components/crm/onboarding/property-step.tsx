'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import type { OnboardingQuestion } from '@/data/onboarding-questions'

interface PropertyStepProps {
  questions: OnboardingQuestion[]
  answers: Record<number, string>
  multiAnswers?: Record<number, string[]>
  onChange: (questionId: number, value: string) => void
  onMultiChange?: (questionId: number, values: string[]) => void
}

export function PropertyStep({
  questions,
  answers,
  multiAnswers = {},
  onChange,
  onMultiChange,
}: PropertyStepProps) {
  const t = useTranslations('onboarding.helpers')

  const handleMultiToggle = (questionId: number, value: string) => {
    const current = multiAnswers[questionId] ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onMultiChange?.(questionId, next)
    // Mirror to answers as comma-separated for simplicity
    onChange(questionId, next.join(','))
  }

  return (
    <div className="space-y-8">
      {questions.map((question) => (
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
                const selectedList = multiAnswers[question.id] ?? []
                const selected = selectedList.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleMultiToggle(question.id, option.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150',
                      'hover:border-current focus:outline-none focus-visible:ring-2',
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
        </div>
      ))}
    </div>
  )
}
