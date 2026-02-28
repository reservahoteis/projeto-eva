'use client'

/**
 * CRM Dashboard — Faithful to Frappe CRM Dashboard.vue
 * Espresso Design System: white bg, clean charts, date range + user filter
 */

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Target,
  Handshake,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { crmApi } from '@/services/crm/api'
import { LayoutHeader } from '@/components/crm/layout-header'
import { ViewBreadcrumbs } from '@/components/crm/view-breadcrumbs'

// ============================================
// CONSTANTS
// ============================================

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const PIPELINE_COLORS = [
  '#007BE0', '#46B37E', '#E79913', '#E03636', '#6846E3',
  '#E34AA6', '#3BBDE5', '#DB7706',
]

const TASK_STATUS_COLORS: Record<string, string> = {
  Backlog: '#999999',
  Todo: '#007BE0',
  'In Progress': '#E79913',
  Done: '#278F5E',
  Canceled: '#E03636',
}

// ============================================
// DATE PRESETS
// ============================================

const datePresets = [
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 60 dias', days: 60 },
  { label: 'Últimos 90 dias', days: 90 },
]

// ============================================
// MAIN COMPONENT
// ============================================

export default function DashboardPage() {
  const [preset, setPreset] = useState(1) // Default: 30 days
  const [showPresets, setShowPresets] = useState(false)

  const fromDate = useMemo(
    () => format(subDays(new Date(), datePresets[preset]?.days ?? 30), 'yyyy-MM-dd'),
    [preset]
  )
  const toDate = format(new Date(), 'yyyy-MM-dd')

  // Fetch data
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ['crm-dashboard-leads', fromDate, toDate],
    queryFn: () => crmApi.leads.list({ page_size: 200 }),
    select: (res) => res.data,
  })

  const { data: dealsData, isLoading: dealsLoading, refetch: refetchDeals } = useQuery({
    queryKey: ['crm-dashboard-deals', fromDate, toDate],
    queryFn: () => crmApi.deals.list({ page_size: 200 }),
    select: (res) => res.data,
  })

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['crm-dashboard-tasks', fromDate, toDate],
    queryFn: () => crmApi.tasks.list({ page_size: 200 }),
    select: (res) => res.data,
  })

  const isLoading = leadsLoading || dealsLoading || tasksLoading

  // Computed stats
  const stats = useMemo(() => {
    const leads = leadsData?.data || []
    const deals = dealsData?.data || []
    const tasks = tasksData?.data || []

    const totalLeads = leads.length
    const totalDeals = deals.length
    const wonDeals = deals.filter((d) => d.status?.label === 'Won' || d.status?.status_type === 'Won')
    const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0)
    const conversionRate = totalLeads > 0 ? ((totalDeals / totalLeads) * 100).toFixed(1) : '0'
    const openTasks = tasks.filter((t) => !['Done', 'Canceled'].includes(t.status)).length

    return { totalLeads, totalDeals, totalRevenue, conversionRate, openTasks }
  }, [leadsData, dealsData, tasksData])

  // Pipeline chart data
  const pipelineData = useMemo(() => {
    const deals = dealsData?.data || []
    const statusCounts: Record<string, number> = {}
    deals.forEach((d) => {
      const label = d.status?.label || 'Unknown'
      statusCounts[label] = (statusCounts[label] || 0) + 1
    })
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
  }, [dealsData])

  // Task status chart
  const taskChartData = useMemo(() => {
    const tasks = tasksData?.data || []
    const statusCounts: Record<string, number> = {}
    tasks.forEach((t) => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
    })
    return Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
      color: TASK_STATUS_COLORS[name] || '#999999',
    }))
  }, [tasksData])

  const handleRefresh = () => {
    refetchLeads()
    refetchDeals()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — matches Dashboard.vue LayoutHeader */}
      <LayoutHeader
        left={<ViewBreadcrumbs items={[{ label: 'Dashboard' }]} />}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors"
              style={{
                color: 'var(--ink-gray-8)',
                border: '1px solid var(--outline-gray-2)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
          </div>
        }
      />

      {/* Filters bar — matches Dashboard.vue date range + user filter */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="inline-flex items-center gap-2 rounded px-3 py-1.5 text-sm"
            style={{
              border: '1px solid var(--outline-gray-2)',
              color: 'var(--ink-gray-8)',
            }}
          >
            <svg className="h-4 w-4" style={{ color: 'var(--ink-gray-5)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {datePresets[preset]?.label}
            <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--ink-gray-5)' }} />
          </button>
          {showPresets && (
            <div
              className="absolute top-full left-0 mt-1 rounded-lg py-1 z-10 min-w-[200px]"
              style={{
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--outline-gray-1)',
                boxShadow: '0px 0px 1px rgba(0,0,0,0.19), 0px 1px 2px rgba(0,0,0,0.07), 0px 6px 15px -5px rgba(0,0,0,0.11)',
              }}
            >
              {datePresets.map((p, i) => (
                <button
                  key={i}
                  onClick={() => { setPreset(i); setShowPresets(false) }}
                  className="w-full px-3 py-2 text-left text-sm transition-colors"
                  style={{
                    color: 'var(--ink-gray-8)',
                    backgroundColor: i === preset ? 'var(--surface-gray-2)' : undefined,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)')}
                  onMouseLeave={(e) => {
                    if (i !== preset) e.currentTarget.style.backgroundColor = ''
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {/* KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCardEspresso
            label="Total Leads"
            value={stats.totalLeads}
            icon={Target}
            loading={isLoading}
          />
          <StatCardEspresso
            label="Negociações"
            value={stats.totalDeals}
            icon={Handshake}
            loading={isLoading}
          />
          <StatCardEspresso
            label="Receita (Ganhas)"
            value={BRL.format(stats.totalRevenue)}
            icon={DollarSign}
            loading={isLoading}
          />
          <StatCardEspresso
            label="Conversão"
            value={`${stats.conversionRate}%`}
            icon={TrendingUp}
            loading={isLoading}
            subtitle={`${stats.openTasks} tarefas abertas`}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Deal Pipeline — horizontal bar chart */}
          <ChartCard title="Pipeline de Negociações">
            {pipelineData.length > 0 ? (
              <HorizontalBarChart data={pipelineData} colors={PIPELINE_COLORS} />
            ) : (
              <EmptyChart />
            )}
          </ChartCard>

          {/* Tasks by Status — donut chart */}
          <ChartCard title="Tarefas por Status">
            {taskChartData.length > 0 ? (
              <DonutChart data={taskChartData} />
            ) : (
              <EmptyChart />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Chart components (pure CSS/SVG, no recharts)
// ============================================

function HorizontalBarChart({
  data,
  colors,
}: {
  data: { name: string; value: number }[]
  colors: string[]
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1)

  return (
    <div className="space-y-3" style={{ minHeight: '200px' }}>
      {data.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3">
          <span
            className="shrink-0 text-right"
            style={{
              width: '90px',
              fontSize: '13px',
              color: 'var(--ink-gray-8)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item.name}
          >
            {item.name}
          </span>
          <div className="flex-1 h-7 rounded" style={{ backgroundColor: 'var(--surface-gray-2)' }}>
            <div
              className="h-full rounded flex items-center justify-end pr-2 transition-all duration-500"
              style={{
                width: `${Math.max((item.value / maxValue) * 100, 8)}%`,
                backgroundColor: colors[i % colors.length],
              }}
            >
              <span style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>
                {item.value}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const size = 200
  const strokeWidth = 40
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  let accumulated = 0

  return (
    <div className="flex flex-col items-center gap-4" style={{ minHeight: '200px' }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-gray-2)"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {data.map((item) => {
            const ratio = item.value / total
            const dashLength = circumference * ratio
            const gapLength = circumference - dashLength
            const offset = circumference * accumulated
            accumulated += ratio

            return (
              <circle
                key={item.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashLength} ${gapLength}`}
                strokeDashoffset={-offset}
                style={{
                  transformOrigin: 'center',
                  transform: 'rotate(-90deg)',
                  transition: 'stroke-dasharray 0.5s ease',
                }}
              />
            )
          })}
        </svg>
        {/* Center label */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink-gray-9)' }}>
            {total}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--ink-gray-5)' }}>total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="rounded-full"
              style={{ width: '8px', height: '8px', backgroundColor: item.color }}
            />
            <span style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
              {item.name} ({item.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// Sub-components
// ============================================

function StatCardEspresso({
  label,
  value,
  icon: Icon,
  loading,
  subtitle,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  loading: boolean
  subtitle?: string
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontSize: '12px', color: 'var(--ink-gray-5)', fontWeight: 500, marginBottom: '2px' }}>
            {label}
          </p>
          {loading ? (
            <div
              className="animate-pulse"
              style={{ height: '32px', width: '80px', backgroundColor: 'var(--surface-gray-2)', borderRadius: '4px', marginTop: '4px' }}
            />
          ) : (
            <p style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink-gray-9)' }}>
              {value}
            </p>
          )}
          {subtitle && (
            <p style={{ fontSize: '12px', color: 'var(--ink-gray-4)', marginTop: '2px' }}>
              {subtitle}
            </p>
          )}
        </div>
        <Icon className="h-5 w-5" style={{ color: 'var(--ink-gray-4)' }} />
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '10px',
        padding: '16px',
      }}
    >
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--ink-gray-9)',
          marginBottom: '16px',
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function EmptyChart() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ height: '300px', color: 'var(--ink-gray-4)', fontSize: '13px' }}
    >
      Sem dados para exibir
    </div>
  )
}
