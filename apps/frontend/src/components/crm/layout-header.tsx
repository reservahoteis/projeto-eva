'use client'

// Faithful recreation of Frappe CRM LayoutHeader.vue
// Renders into the #crm-header teleport target via portal

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'

interface LayoutHeaderProps {
  left?: React.ReactNode
  right?: React.ReactNode
}

export function LayoutHeader({ left, right }: LayoutHeaderProps) {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setTarget(document.getElementById('crm-header'))
  }, [])

  const header = (
    <header
      className="flex items-center justify-between py-[7px] px-5"
      style={{ height: '42px' }}
    >
      <div className="flex items-center gap-2">{left}</div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  )

  if (target) {
    return createPortal(header, target)
  }

  return header
}
