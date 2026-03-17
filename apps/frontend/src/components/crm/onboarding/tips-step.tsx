'use client'

import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import type { OnboardingQuestion } from '@/data/onboarding-questions'

interface TipsStepProps {
  questions: OnboardingQuestion[]
  // answers[questionId][optionValue] = texto digitado pelo usuário
  answers: Record<number, Record<string, string>>
  onChange: (questionId: number, field: string, value: string) => void
}

export function TipsStep({ questions, answers, onChange }: TipsStepProps) {
  const t = useTranslations('onboarding.helpers')

  return (
    <div className="space-y-10">
      {questions.map((question) => (
        <div key={question.id}>
          {/* Header */}
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
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--ink-gray-5)' }}>
              {t('listFavorites')}
            </p>
          </div>

          {/* 5 input fields */}
          <div className="space-y-2">
            {question.options.map((option, idx) => (
              <div key={option.value} className="flex items-center gap-3">
                {/* Position badge */}
                <div
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    backgroundColor: answers[question.id]?.[option.value]
                      ? 'var(--surface-gray-7)'
                      : 'var(--surface-gray-3)',
                    color: answers[question.id]?.[option.value]
                      ? '#fff'
                      : 'var(--ink-gray-5)',
                  }}
                >
                  {idx + 1}
                </div>

                <Input
                  type="text"
                  placeholder={option.label}
                  value={answers[question.id]?.[option.value] ?? ''}
                  onChange={(e) => onChange(question.id, option.value, e.target.value)}
                  className="h-9 text-sm rounded border flex-1"
                  style={{
                    borderColor: 'var(--outline-gray-2)',
                    backgroundColor: 'var(--surface-white)',
                    color: 'var(--ink-gray-8)',
                  }}
                  maxLength={200}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
