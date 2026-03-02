'use client'

import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Target,
  Handshake,
  Users,
  Building2,
  TrendingUp,
  DollarSign,
  BarChart3,
  CheckCircle2,
} from 'lucide-react'
import { crmApi } from '@/services/crm/api'

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
}) {
  return (
    <div
      className="flex items-center gap-4 rounded-lg border p-4"
      style={{ borderColor: 'var(--outline-gray-1)' }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--ink-gray-5)' }}
        >
          {label}
        </p>
        <p
          className="text-xl font-semibold"
          style={{ color: 'var(--ink-gray-9)' }}
        >
          {value}
        </p>
      </div>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function CrmDashboardPage() {
  const t = useTranslations('dashboard')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['crm-dashboard-stats'],
    queryFn: () => crmApi.dashboard.stats(),
    select: (res) => res.data,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: 'var(--ink-gray-3)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm" style={{ color: 'var(--ink-gray-5)' }}>
            Loading...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1
        className="mb-6 text-xl font-semibold"
        style={{ color: 'var(--ink-gray-9)' }}
      >
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label={t('totalLeads')}
          value={stats?.total_leads ?? 0}
          color="#3B82F6"
        />
        <StatCard
          icon={Handshake}
          label={t('totalDeals')}
          value={stats?.total_deals ?? 0}
          color="#8B5CF6"
        />
        <StatCard
          icon={BarChart3}
          label={t('openDeals')}
          value={stats?.open_deals ?? 0}
          color="#F59E0B"
        />
        <StatCard
          icon={CheckCircle2}
          label={t('wonDeals')}
          value={stats?.won_deals ?? 0}
          color="#10B981"
        />
        <StatCard
          icon={DollarSign}
          label={t('revenue')}
          value={formatCurrency(stats?.won_value ?? 0)}
          color="#059669"
        />
        <StatCard
          icon={TrendingUp}
          label={t('conversionRate')}
          value={`${stats?.conversion_rate ?? 0}%`}
          color="#6366F1"
        />
        <StatCard
          icon={Users}
          label="Contacts"
          value={stats?.total_contacts ?? 0}
          color="#EC4899"
        />
        <StatCard
          icon={Building2}
          label="Organizations"
          value={stats?.total_organizations ?? 0}
          color="#14B8A6"
        />
      </div>
    </div>
  )
}
