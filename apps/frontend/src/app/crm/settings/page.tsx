'use client'

/**
 * CRM Settings Page — Faithful to Frappe CRM Settings.vue
 * Left sidebar with tabs, right panel with settings content
 */

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Settings,
  Mail,
  Phone,
  MessageSquare,
  Palette,
  CircleDollarSign,
} from 'lucide-react'
import { crmApi } from '@/services/crm/api'
import { LayoutHeader } from '@/components/crm/layout-header'
import { ViewBreadcrumbs } from '@/components/crm/view-breadcrumbs'

// ============================================
// SETTINGS TABS
// ============================================

interface SettingsTab {
  label: string
  icon: React.ElementType
  component: React.FC
}

interface SettingsGroup {
  label: string
  items: SettingsTab[]
}

// ============================================
// Settings sub-pages
// ============================================

function ProfileSection() {
  return (
    <div className="p-6">
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '16px' }}>
        Perfil
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
        Gerencie suas informações pessoais e preferências.
      </p>
      <div className="mt-6 space-y-4">
        <FieldRow label="Nome" value="Carregando..." />
        <FieldRow label="Email" value="Carregando..." />
      </div>
    </div>
  )
}

function UsersSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-settings-users'],
    queryFn: () => crmApi.users.list(),
    select: (res) => res.data,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)' }}>
          Usuários
        </h2>
        <button
          style={{
            backgroundColor: 'var(--surface-gray-7)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          Convidar Usuário
        </button>
      </div>
      <div style={{ border: '1px solid var(--outline-gray-1)', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-gray-4)' }}>
                  Carregando...
                </td>
              </tr>
            ) : (data?.items || []).length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-gray-4)' }}>
                  Nenhum usuário encontrado
                </td>
              </tr>
            ) : (
              (data?.items || []).map((user: any) => (
                <tr
                  key={user.id}
                  style={{ borderBottom: '1px solid var(--surface-gray-2)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <Td>{user.name}</Td>
                  <Td>{user.email}</Td>
                  <Td>{user.role || '-'}</Td>
                  <Td>
                    <span
                      style={{
                        fontSize: '12px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: user.is_active ? 'var(--surface-green-2)' : 'var(--surface-gray-2)',
                        color: user.is_active ? 'var(--ink-green-3)' : 'var(--ink-gray-5)',
                      }}
                    >
                      {user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusesSection() {
  const { data: leadStatuses, isLoading: leadLoading } = useQuery({
    queryKey: ['crm-lead-statuses'],
    queryFn: () => crmApi.settings.statuses.listLead(),
    select: (res) => res.data,
  })

  const { data: dealStatuses, isLoading: dealLoading } = useQuery({
    queryKey: ['crm-deal-statuses'],
    queryFn: () => crmApi.settings.statuses.listDeal(),
    select: (res) => res.data,
  })

  return (
    <div className="p-6">
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '16px' }}>
        Status
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)', marginBottom: '24px' }}>
        Configure os status disponíveis para Leads e Negociações.
      </p>

      <div className="space-y-8">
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '12px' }}>
            Status de Lead
          </h3>
          <StatusList items={leadStatuses} loading={leadLoading} />
        </div>
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '12px' }}>
            Status de Negociação
          </h3>
          <StatusList items={dealStatuses} loading={dealLoading} />
        </div>
      </div>
    </div>
  )
}

function StatusList({ items, loading }: { items?: any[]; loading: boolean }) {
  if (loading) {
    return <div style={{ color: 'var(--ink-gray-4)', fontSize: '13px' }}>Carregando...</div>
  }
  if (!items || items.length === 0) {
    return <div style={{ color: 'var(--ink-gray-4)', fontSize: '13px' }}>Nenhum status configurado</div>
  }
  return (
    <div style={{ border: '1px solid var(--outline-gray-1)', borderRadius: '8px', overflow: 'hidden' }}>
      {items.map((status: any, i: number) => (
        <div
          key={status.id}
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: i < items.length - 1 ? '1px solid var(--surface-gray-2)' : undefined,
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: status.color || 'var(--ink-gray-4)',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '14px', color: 'var(--ink-gray-8)' }}>
            {status.label}
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '12px',
              color: 'var(--ink-gray-4)',
            }}
          >
            {status.type}
          </span>
        </div>
      ))}
    </div>
  )
}

function EmailSection() {
  return (
    <div className="p-6">
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '16px' }}>
        Email
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
        Configure contas de email para envio e recebimento de mensagens.
      </p>
    </div>
  )
}

function TelephonySection() {
  return (
    <div className="p-6">
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '16px' }}>
        Telefonia
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
        Configure integração com Twilio ou outro provedor de telefonia.
      </p>
    </div>
  )
}

function WhatsAppSection() {
  return (
    <div className="p-6">
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '16px' }}>
        WhatsApp
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
        Configure integração com WhatsApp Cloud API.
      </p>
    </div>
  )
}

function CurrencySection() {
  return (
    <div className="p-6">
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink-gray-9)', marginBottom: '16px' }}>
        Moeda
      </h2>
      <p style={{ fontSize: '14px', color: 'var(--ink-gray-5)' }}>
        Configure a moeda padrão para valores monetários.
      </p>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

const settingsGroups: SettingsGroup[] = [
  {
    label: 'Geral',
    items: [
      { label: 'Perfil', icon: Settings, component: ProfileSection },
      { label: 'Usuários', icon: Users, component: UsersSection },
      { label: 'Status', icon: Palette, component: StatusesSection },
      { label: 'Moeda', icon: CircleDollarSign, component: CurrencySection },
    ],
  },
  {
    label: 'Integrações',
    items: [
      { label: 'Email', icon: Mail, component: EmailSection },
      { label: 'Telefonia', icon: Phone, component: TelephonySection },
      { label: 'WhatsApp', icon: MessageSquare, component: WhatsAppSection },
    ],
  },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Perfil')

  const allTabs = settingsGroups.flatMap((g) => g.items)
  // allTabs is always non-empty (settingsGroups is a module-level constant with items)
  const currentTab = allTabs.find((t) => t.label === activeTab) ?? allTabs[0]!
  const ActiveComponent = currentTab.component

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <LayoutHeader
        left={<ViewBreadcrumbs items={[{ label: 'Configurações' }]} />}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — matches Settings.vue left panel */}
        <div
          className="flex flex-col py-1 w-52 shrink-0 overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-menu-bar)' }}
        >
          {settingsGroups.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="mx-1 mb-0.5 mt-[5px]" />}
              <div
                className="flex items-center gap-1.5 px-3 py-[7px] my-[3px] text-sm"
                style={{ color: 'var(--ink-gray-5)' }}
              >
                {group.label}
              </div>
              <nav className="space-y-[3px] px-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.label
                  return (
                    <button
                      key={item.label}
                      onClick={() => setActiveTab(item.label)}
                      className="flex h-[30px] w-full items-center rounded px-2 py-[7px] text-sm transition-all"
                      style={{
                        color: 'var(--ink-gray-8)',
                        backgroundColor: isActive ? 'var(--surface-selected)' : undefined,
                        boxShadow: isActive
                          ? '0px 0px 1px rgba(0,0,0,0.45), 0px 1px 2px rgba(0,0,0,0.1)'
                          : undefined,
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive)
                          e.currentTarget.style.backgroundColor = 'var(--surface-gray-3)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = ''
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2" style={{ color: 'var(--ink-gray-8)' }} />
                      {item.label}
                    </button>
                  )
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* Content */}
        <div
          className="flex flex-1 flex-col overflow-y-auto"
          style={{ backgroundColor: 'var(--surface-white)' }}
        >
          <ActiveComponent />
        </div>
      </div>
    </div>
  )
}

// ============================================
// Shared sub-components
// ============================================

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <span
        style={{
          width: '120px',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--ink-gray-5)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: '14px', color: 'var(--ink-gray-8)' }}>
        {value}
      </span>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: 'left',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--ink-gray-5)',
        padding: '8px 12px',
        borderBottom: '1px solid var(--outline-gray-1)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: '10px 12px',
        fontSize: '14px',
        color: 'var(--ink-gray-8)',
        verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  )
}
