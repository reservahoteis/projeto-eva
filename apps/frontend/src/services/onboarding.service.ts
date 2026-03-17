// ============================================
// Onboarding Service
// Chamadas ao backend /api/v1/onboarding
// ============================================

import api from '@/lib/axios'

const BASE = '/api/v1/onboarding'

export interface OnboardingResponse {
  id: string
  tenantId: string
  currentStep: number
  completed: boolean
  personalityAnswers: Record<string, string> | null
  propertyAnswers: Record<string, string> | null
  tipsAnswers: Record<string, Record<string, string>> | null
  archetype: string | null
  createdAt: string
  updatedAt: string
}

export interface SavePersonalityPayload {
  answers: Record<number, string>
  currentStep: number
}

export interface SavePropertyPayload {
  answers: Record<number, string>
  currentStep: number
}

export interface SaveTipsPayload {
  answers: Record<number, Record<string, string>>
  currentStep: number
}

export const onboardingService = {
  get: () =>
    api.get<OnboardingResponse>(BASE),

  savePersonality: (data: SavePersonalityPayload) =>
    api.patch<OnboardingResponse>(`${BASE}/personality`, data),

  saveProperty: (data: SavePropertyPayload) =>
    api.patch<OnboardingResponse>(`${BASE}/property`, data),

  saveTips: (data: SaveTipsPayload) =>
    api.patch<OnboardingResponse>(`${BASE}/tips`, data),

  complete: () =>
    api.post<OnboardingResponse>(`${BASE}/complete`),
}
