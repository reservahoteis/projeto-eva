'use client'

// Shared Comments tab — wrapper around ActivityTimeline focused on comments.
// Shows the comment form + comment list for a given entity.

import { ActivityTimeline } from '@/components/crm/activity-timeline'
import type { CrmDoctype } from '@/types/crm'

interface CommentsTabProps {
  doctype: CrmDoctype
  docname: string
  currentUserId?: string
}

export function CommentsTab({ doctype, docname, currentUserId }: CommentsTabProps) {
  return <ActivityTimeline doctype={doctype} docname={docname} currentUserId={currentUserId} />
}
