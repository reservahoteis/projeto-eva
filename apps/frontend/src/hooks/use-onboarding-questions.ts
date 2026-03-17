'use client'

import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import {
  personalityQuestions,
  propertyQuestions,
  tipsQuestions,
  archetypes,
  type OnboardingQuestion,
  type Archetype,
  type ArchetypeKey,
} from '@/data/onboarding-questions'

/**
 * Hook that returns onboarding questions and archetypes
 * translated to the current locale.
 *
 * PT-BR is the base language (used as-is).
 * EN applies translations from the EN translations file.
 */
export function useOnboardingQuestions() {
  const locale = useLocale()

  return useMemo(() => {
    if (locale === 'en') {
      // Dynamically import EN translations (they're lightweight maps)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {
        personalityTranslations,
        propertyTranslations,
        tipsTranslations,
        archetypeTranslations,
      } = require('@/data/onboarding-questions-en')

      const translateQuestions = (
        questions: OnboardingQuestion[],
        translations: Record<number, { theme: string; question: string; options: Record<string, string> }>,
      ): OnboardingQuestion[] =>
        questions.map((q) => {
          const t = translations[q.id]
          if (!t) return q
          return {
            ...q,
            theme: t.theme,
            question: t.question,
            options: q.options.map((opt) => ({
              ...opt,
              label: t.options[opt.value] ?? opt.label,
            })),
          }
        })

      const translatedArchetypes: Record<ArchetypeKey, Archetype> = { ...archetypes }
      for (const key of Object.keys(archetypeTranslations) as ArchetypeKey[]) {
        const at = archetypeTranslations[key]
        if (at && translatedArchetypes[key]) {
          translatedArchetypes[key] = {
            ...translatedArchetypes[key],
            name: at.name,
            description: at.description,
            traits: at.traits,
          }
        }
      }

      return {
        personalityQuestions: translateQuestions(personalityQuestions, personalityTranslations),
        propertyQuestions: translateQuestions(propertyQuestions, propertyTranslations),
        tipsQuestions: translateQuestions(tipsQuestions, tipsTranslations),
        archetypes: translatedArchetypes,
      }
    }

    // PT-BR — use base data as-is
    return {
      personalityQuestions,
      propertyQuestions,
      tipsQuestions,
      archetypes,
    }
  }, [locale])
}
