/**
 * Unidades hoteleiras disponíveis
 * Usado para filtrar conversas por atendente
 */
export const HOTEL_UNITS = [
  'Ilhabela',
  'Campos do Jordão',
  'Camburi',
  'Santo Antônio do Pinhal',
] as const;

export type HotelUnit = (typeof HOTEL_UNITS)[number];

/**
 * Valida se uma string é uma unidade hoteleira válida
 */
export function isValidHotelUnit(unit: string | null | undefined): unit is HotelUnit {
  if (!unit) return false;
  return HOTEL_UNITS.includes(unit as HotelUnit);
}
