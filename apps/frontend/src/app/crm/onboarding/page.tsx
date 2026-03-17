'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Wand2, PartyPopper, Bot } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/layout/protected-route'
import { UserRole } from '@/types'
import { cn } from '@/lib/utils'

import { WizardProgress } from '@/components/crm/onboarding/wizard-progress'
import { PersonalityStep } from '@/components/crm/onboarding/personality-step'
import { PropertyStep } from '@/components/crm/onboarding/property-step'
import { TipsStep } from '@/components/crm/onboarding/tips-step'
import { ArchetypeResult } from '@/components/crm/onboarding/archetype-result'

import {
  calculateArchetype,
  type ArchetypeKey,
} from '@/data/onboarding-questions'
import { useOnboardingQuestions } from '@/hooks/use-onboarding-questions'
import { onboardingService } from '@/services/onboarding.service'

// ============================================
// Step configuration
// ============================================

const TOTAL_STEPS = 15

// Personality slice ranges by step
const PERSONALITY_SLICES: Record<number, [number, number]> = {
  2: [0, 5],    // Identidade (1-5)
  3: [5, 9],    // Comunicação (6-9)
  4: [9, 13],   // Relação (10-13)
  5: [13, 22],  // Inteligência + Personalidade (14-22)
  6: [22, 33],  // Humor + Postura + Proatividade (23-33)
  7: [33, 50],  // Experiência … Encerramento (34-50)
}

// Property slice ranges by step
const PROPERTY_SLICES: Record<number, [number, number]> = {
  9: [0, 5],     // Endereço (1-5)
  10: [5, 19],   // Tipo & Localização (6-19)
  11: [19, 54],  // Perfil + Estrutura (20-54)
  12: [54, 68],  // Gastronomia (55-68)
  13: [68, 90],  // Experiência + Serviços (69-90)
}

// ============================================
// Intro step content
// ============================================

function IntroStep() {
  const t = useTranslations('onboarding.intro')

  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: 'var(--surface-gray-2)' }}
      >
        <Bot className="w-8 h-8" style={{ color: 'var(--ink-gray-8)' }} />
      </div>

      <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--ink-gray-9)' }}>
        {t('title')}
      </h2>

      <p
        className="text-sm mb-6 max-w-md leading-relaxed"
        style={{ color: 'var(--ink-gray-6)' }}
        dangerouslySetInnerHTML={{ __html: t('description') }}
      />

      <div className="w-full max-w-sm space-y-3 text-left mb-6">
        {[
          { icon: '🎭', label: t('section1Label'), desc: t('section1Desc') },
          { icon: '🏨', label: t('section2Label'), desc: t('section2Desc') },
          { icon: '💡', label: t('section3Label'), desc: t('section3Desc') },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ backgroundColor: 'var(--surface-gray-1)', border: '1px solid var(--outline-gray-1)' }}
          >
            <span className="text-xl flex-shrink-0" role="img" aria-hidden="true">{item.icon}</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: 'var(--ink-gray-8)' }}>{item.label}</p>
              <p className="text-xs" style={{ color: 'var(--ink-gray-5)' }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: 'var(--ink-gray-4)' }}>
        {t('autoSaveNote')}
      </p>
    </div>
  )
}

// ============================================
// Conclusion step
// ============================================

function ConclusionStep({ onComplete, isLoading }: { onComplete: () => void; isLoading: boolean }) {
  const t = useTranslations('onboarding.conclusion')

  return (
    <div className="flex flex-col items-center text-center py-8 px-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: 'var(--surface-green-2)' }}
      >
        <PartyPopper className="w-8 h-8" style={{ color: 'var(--ink-green-3)' }} />
      </div>

      <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--ink-gray-9)' }}>
        {t('title')}
      </h2>

      <p className="text-sm mb-8 max-w-sm leading-relaxed" style={{ color: 'var(--ink-gray-6)' }}>
        {t('description')}
      </p>

      <Button
        onClick={onComplete}
        disabled={isLoading}
        size="lg"
        className="px-8 rounded-lg text-white hover:opacity-90"
        style={{ backgroundColor: 'var(--surface-gray-7)' }}
      >
        {isLoading ? (
          <>
            <span className="mr-2">{t('activating')}</span>
          </>
        ) : (
          <>
            <Wand2 className="mr-2 w-4 h-4" />
            {t('activateButton')}
          </>
        )}
      </Button>
    </div>
  )
}

// ============================================
// Main Wizard Page
// ============================================

function OnboardingWizardContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const t = useTranslations('onboarding')
  const {
    personalityQuestions,
    propertyQuestions,
    tipsQuestions,
    archetypes: translatedArchetypes,
  } = useOnboardingQuestions()

  // Build step labels from translations
  const stepLabels = Array.from({ length: TOTAL_STEPS }, (_, i) => t(`stepLabels.${i + 1}`))

  const [currentStep, setCurrentStep] = useState(1)
  const [isSaving, setIsSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  // Personality answers: questionId → selectedValue
  const [personalityAnswers, setPersonalityAnswers] = useState<Record<number, string>>({})

  // Property answers — single/text: questionId → string
  const [propertyAnswers, setPropertyAnswers] = useState<Record<number, string>>({})
  // Property multiple: questionId → string[]
  const [propertyMultiAnswers, setPropertyMultiAnswers] = useState<Record<number, string[]>>({})

  // Tips answers: questionId → {fieldValue → text}
  const [tipsAnswers, setTipsAnswers] = useState<Record<number, Record<string, string>>>({})

  // Calculated archetype
  const [archetypeKey, setArchetypeKey] = useState<ArchetypeKey | null>(null)

  // Auto-save debounce ref
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ============================================
  // Load existing onboarding data
  // ============================================

  const { data: existing } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => onboardingService.get(),
    select: (res) => res.data,
    retry: false,
  })

  useEffect(() => {
    if (!existing) return

    if (existing.personalityAnswers) {
      const parsed: Record<number, string> = {}
      Object.entries(existing.personalityAnswers).forEach(([k, v]) => {
        parsed[Number(k)] = v as string
      })
      setPersonalityAnswers(parsed)
    }

    if (existing.propertyAnswers) {
      const parsed: Record<number, string> = {}
      const parsedMulti: Record<number, string[]> = {}
      Object.entries(existing.propertyAnswers).forEach(([k, v]) => {
        const id = Number(k)
        const val = v as string
        parsed[id] = val
        if (val.includes(',')) {
          parsedMulti[id] = val.split(',')
        }
      })
      setPropertyAnswers(parsed)
      setPropertyMultiAnswers(parsedMulti)
    }

    if (existing.tipsAnswers) {
      const parsed: Record<number, Record<string, string>> = {}
      Object.entries(existing.tipsAnswers).forEach(([k, v]) => {
        parsed[Number(k)] = v as Record<string, string>
      })
      setTipsAnswers(parsed)
    }

    if (existing.archetype) {
      setArchetypeKey(existing.archetype as ArchetypeKey)
    }

    if (existing.currentStep && existing.currentStep > 1) {
      setCurrentStep(existing.currentStep)
    }
  }, [existing])

  // ============================================
  // Auto-save mutations
  // ============================================

  const personalityMutation = useMutation({
    mutationFn: onboardingService.savePersonality,
    onSuccess: () => {
      setIsSaving(false)
      setSavedAt(new Date())
    },
    onError: () => {
      setIsSaving(false)
    },
  })

  const propertyMutation = useMutation({
    mutationFn: onboardingService.saveProperty,
    onSuccess: () => {
      setIsSaving(false)
      setSavedAt(new Date())
    },
    onError: () => {
      setIsSaving(false)
    },
  })

  const tipsMutation = useMutation({
    mutationFn: onboardingService.saveTips,
    onSuccess: () => {
      setIsSaving(false)
      setSavedAt(new Date())
    },
    onError: () => {
      setIsSaving(false)
    },
  })

  const completeMutation = useMutation({
    mutationFn: onboardingService.complete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] })
      toast.success(t('toast.activated'))
      router.push('/crm')
    },
    onError: () => {
      toast.error(t('toast.error'))
    },
  })

  // ============================================
  // Debounced auto-save
  // ============================================

  const triggerAutoSave = useCallback(
    (step: number) => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setIsSaving(true)

      saveTimer.current = setTimeout(() => {
        const isPersonalityStep = step >= 2 && step <= 7
        const isPropertyStep = step >= 9 && step <= 13
        const isTipsStep = step === 14

        if (isPersonalityStep) {
          personalityMutation.mutate({ answers: personalityAnswers, currentStep: step })
        } else if (isPropertyStep) {
          propertyMutation.mutate({ answers: propertyAnswers, currentStep: step })
        } else if (isTipsStep) {
          tipsMutation.mutate({ answers: tipsAnswers, currentStep: step })
        } else {
          setIsSaving(false)
        }
      }, 1000)
    },
    [personalityAnswers, propertyAnswers, tipsAnswers, personalityMutation, propertyMutation, tipsMutation],
  )

  // ============================================
  // Answer handlers
  // ============================================

  const handlePersonalityChange = (questionId: number, value: string) => {
    setPersonalityAnswers((prev) => ({ ...prev, [questionId]: value }))
    triggerAutoSave(currentStep)
  }

  const handlePropertyChange = (questionId: number, value: string) => {
    setPropertyAnswers((prev) => ({ ...prev, [questionId]: value }))
    triggerAutoSave(currentStep)
  }

  const handlePropertyMultiChange = (questionId: number, values: string[]) => {
    setPropertyMultiAnswers((prev) => ({ ...prev, [questionId]: values }))
  }

  const handleTipsChange = (questionId: number, field: string, value: string) => {
    setTipsAnswers((prev) => ({
      ...prev,
      [questionId]: { ...(prev[questionId] ?? {}), [field]: value },
    }))
    triggerAutoSave(currentStep)
  }

  // ============================================
  // Navigation
  // ============================================

  const goNext = () => {
    // Step 7 → 8: calculate archetype before showing result
    if (currentStep === 7) {
      const arch = calculateArchetype(personalityAnswers)
      setArchetypeKey(arch)
    }

    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1)
      // Save on advance
      triggerAutoSave(currentStep + 1)
    }
  }

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1)
  }

  const handleComplete = () => {
    completeMutation.mutate()
  }

  // ============================================
  // Render step content
  // ============================================

  const renderStepContent = () => {
    // Step 1: Intro
    if (currentStep === 1) return <IntroStep />

    // Steps 2-7: Personality quiz
    if (currentStep >= 2 && currentStep <= 7) {
      const range = PERSONALITY_SLICES[currentStep]
      const slice = range ? personalityQuestions.slice(range[0], range[1]) : []
      return (
        <PersonalityStep
          questions={slice}
          answers={personalityAnswers}
          onChange={handlePersonalityChange}
        />
      )
    }

    // Step 8: Archetype result
    if (currentStep === 8) {
      if (!archetypeKey) {
        const computed = calculateArchetype(personalityAnswers)
        return <ArchetypeResult archetypeKey={computed} archetypes={translatedArchetypes} />
      }
      return <ArchetypeResult archetypeKey={archetypeKey} archetypes={translatedArchetypes} />
    }

    // Steps 9-13: Property questions
    if (currentStep >= 9 && currentStep <= 13) {
      const range = PROPERTY_SLICES[currentStep]
      const slice = range ? propertyQuestions.slice(range[0], range[1]) : []
      return (
        <PropertyStep
          questions={slice}
          answers={propertyAnswers}
          multiAnswers={propertyMultiAnswers}
          onChange={handlePropertyChange}
          onMultiChange={handlePropertyMultiChange}
        />
      )
    }

    // Step 14: Tips
    if (currentStep === 14) {
      return (
        <TipsStep
          questions={tipsQuestions}
          answers={tipsAnswers}
          onChange={handleTipsChange}
        />
      )
    }

    // Step 15: Conclusion
    if (currentStep === 15) {
      return (
        <ConclusionStep
          onComplete={handleComplete}
          isLoading={completeMutation.isPending}
        />
      )
    }

    return null
  }

  const isFirstStep = currentStep === 1

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--surface-white)' }}>
      {/* Progress bar */}
      <WizardProgress
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        stepLabels={stepLabels}
        isSaving={isSaving}
        savedAt={savedAt}
      />

      {/* Animated step content */}
      <div
        key={currentStep}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6"
        style={{
          animation: 'fadeSlideIn 0.25s ease-out',
        }}
      >
        <div className="max-w-2xl mx-auto">
          {renderStepContent()}
        </div>
      </div>

      {/* Navigation footer — hidden on step 15 (has its own button) */}
      {currentStep < 15 && (
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-t"
          style={{ borderColor: 'var(--outline-gray-1)', backgroundColor: 'var(--surface-white)' }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={goPrev}
            disabled={isFirstStep}
            className={cn(
              'h-9 px-4 rounded-lg text-sm border',
              isFirstStep && 'invisible',
            )}
            style={{
              borderColor: 'var(--outline-gray-2)',
              color: 'var(--ink-gray-7)',
            }}
          >
            <ChevronLeft className="mr-1 w-4 h-4" />
            {t('nav.previous')}
          </Button>

          <Button
            size="sm"
            onClick={goNext}
            className="h-9 px-5 rounded-lg text-sm text-white hover:opacity-90"
            style={{ backgroundColor: 'var(--surface-gray-7)' }}
          >
            {currentStep === 14 ? t('nav.goToConclusion') : t('nav.next')}
            <ChevronRight className="ml-1 w-4 h-4" />
          </Button>
        </div>
      )}

      {/* CSS animation keyframes injected inline */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]}>
      <OnboardingWizardContent />
    </ProtectedRoute>
  )
}
