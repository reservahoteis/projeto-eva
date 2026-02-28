import { redirect } from 'next/navigation'

/**
 * /crm root redirects to /crm/leads
 * This is a server component — no 'use client' needed for redirect
 */
export default function CrmRootPage() {
  redirect('/crm/leads')
}
