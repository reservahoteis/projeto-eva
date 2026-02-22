// ============================================
// Business Hours Checker
// BRT timezone (America/Sao_Paulo)
// ============================================

import { BUSINESS_HOURS } from '../config/eva.constants';

/**
 * Retorna a hora atual em BRT (Brasilia).
 */
function getNowBRT(): Date {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
}

/**
 * Verifica se estamos dentro do horario comercial (10h-18h seg-sex BRT).
 */
export function isWithinBusinessHours(): boolean {
  const now = getNowBRT();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Dom, 6=Sab

  // Fim de semana = fora do horario
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  return hour >= BUSINESS_HOURS.start && hour < BUSINESS_HOURS.end;
}

/**
 * Retorna mensagem sobre proximo horario de atendimento.
 * Ex: "segunda-feira as 10h", "amanha as 10h", "as 10h"
 */
export function getNextBusinessHoursMessage(): string {
  const now = getNowBRT();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  // Se e dia util e antes do horario, atendimento e hoje
  if (dayOfWeek >= 1 && dayOfWeek <= 5 && hour < BUSINESS_HOURS.start) {
    return `as ${BUSINESS_HOURS.start}h`;
  }

  // Sabado -> segunda
  if (dayOfWeek === 6) {
    return `segunda-feira as ${BUSINESS_HOURS.start}h`;
  }

  // Domingo -> segunda (amanha)
  if (dayOfWeek === 0) {
    return `amanha (segunda-feira) as ${BUSINESS_HOURS.start}h`;
  }

  // Sexta apos horario -> segunda
  if (dayOfWeek === 5 && hour >= BUSINESS_HOURS.end) {
    return `segunda-feira as ${BUSINESS_HOURS.start}h`;
  }

  // Dia util apos horario -> amanha
  return `amanha as ${BUSINESS_HOURS.start}h`;
}
