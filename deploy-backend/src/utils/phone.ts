/**
 * Normaliza telefones brasileiros para o formato correto com 13 digitos.
 *
 * WhatsApp envia inbound com 13 digitos: 55 + DDD(2) + 9 + numero(8)
 * N8N as vezes envia outbound com 12 digitos: 55 + DDD(2) + numero(8) (falta o 9)
 *
 * Essa inconsistencia cria contatos/conversas duplicados.
 * Esta funcao insere o 9 apos o DDD quando faltante.
 */
export function normalizeBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // BR celular: 55 + DDD(2) + 9 + numero(8) = 13 digitos
  // Se veio 12 digitos comecando com 55, falta o 9 apos o DDD
  if (digits.length === 12 && digits.startsWith('55')) {
    return digits.slice(0, 4) + '9' + digits.slice(4);
  }

  return digits;
}
