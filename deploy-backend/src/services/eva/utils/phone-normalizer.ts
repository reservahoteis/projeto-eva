// ============================================
// Phone Number Normalizer
// Extracted from N8N Orchestrator workflow
// ============================================

/**
 * Normaliza numeros de telefone para formato padrao.
 * Suporta Brasil (55+DDD+9) e EUA/Canada (1+10 digitos).
 * Extraido do JS Code node do workflow N8N orquestrador.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  // EUA/Canada: 11 digitos comecando com 1
  if (digits.startsWith('1') && digits.length === 11) return digits;

  // EUA/Canada: 10 digitos sem codigo de pais
  if (digits.length === 10 && !digits.startsWith('55')) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd < 11 || ddd > 99) return '1' + digits;
    return '55' + digits.slice(0, 2) + '9' + digits.slice(2);
  }

  // Brasil: 13 digitos completo (55 + DDD + 9 + 8 digitos)
  if (digits.startsWith('55') && digits.length === 13) return digits;

  // Brasil: 12 digitos (falta o 9 do celular)
  if (digits.startsWith('55') && digits.length === 12) {
    return digits.slice(0, 4) + '9' + digits.slice(4);
  }

  // Brasil: 11 digitos sem codigo de pais (DDD + 9 + 8 digitos)
  if (digits.length === 11) {
    const ddd = parseInt(digits.slice(0, 2));
    if (ddd >= 11 && ddd <= 99) return '55' + digits;
  }

  return digits || raw;
}
