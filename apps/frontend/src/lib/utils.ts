import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 * Used by Shadcn/ui components
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date to Brazilian format
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';

    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Format datetime to Brazilian format
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';

    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Format time only
 */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';

    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Format phone number to WhatsApp format
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return 'N/A';

  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Format: +55 (11) 98765-4321
  if (cleaned.length === 13) {
    return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }

  return phone;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string | null | undefined, length: number): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

/**
 * Get initials from name
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return 'N/A';

  return name
    .split(' ')
    .filter(Boolean) // Remove empty strings
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'N/A';
}

/**
 * Parse tenant slug from subdomain
 * Example: hotelcopacabana.seucrm.com -> hotelcopacabana
 */
export function getTenantFromHostname(hostname: string | null | undefined): string | null {
  if (!hostname) return null;

  const parts = hostname.split('.');
  const firstPart = parts[0];
  const lastPart = parts[parts.length - 1];

  // localhost:3000 or super-admin.localhost:3000
  if (firstPart === 'localhost' || (lastPart && lastPart.includes('localhost'))) {
    return firstPart === 'localhost' ? null : (firstPart ?? null);
  }

  // Production: tenant.seucrm.com
  if (parts.length >= 3 && firstPart) {
    return firstPart === 'www' || firstPart === 'super-admin' ? null : firstPart;
  }

  return null;
}

/**
 * Sleep utility for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
