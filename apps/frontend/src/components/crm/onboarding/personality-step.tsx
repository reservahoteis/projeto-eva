'use client'

import { cn } from '@/lib/utils'
import type { OnboardingQuestion } from '@/data/onboarding-questions'

interface PersonalityStepProps {
  questions: OnboardingQuestion[]
  answers: Record<number, string>
  onChange: (questionId: number, value: string) => void
}

export function PersonalityStep({ questions, answers, onChange }: PersonalityStepProps) {
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
          </div>

          {/* Option cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {question.options.map((option) => {
              const selected = answers[question.id] === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(question.id, option.value)}
                  className={cn(
                    'relative text-left px-4 py-3 rounded-lg border transition-all duration-150',
                    'hover:border-current focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  )}
                  style={{
                    borderColor: selected ? 'var(--ink-gray-9)' : 'var(--outline-gray-2)',
                    backgroundColor: selected ? 'var(--surface-gray-7)' : 'var(--surface-white)',
                    color: selected ? '#fff' : 'var(--ink-gray-8)',
                  }}
                  aria-pressed={selected}
                >
                  <span className="text-sm font-medium">{option.label}</span>

                  {/* Checkmark */}
                  {selected && (
                    <span
                      className="absolute top-2.5 right-3 text-xs font-bold"
                      style={{ color: '#fff' }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
