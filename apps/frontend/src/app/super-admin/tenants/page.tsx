'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantService } from '@/services/tenant.service';
import { Plus, Building2, Users, MessageSquare, Copy, Check, KeyRound } from 'lucide-react';
import { CreateTenantDialog } from '@/components/super-admin/create-tenant-dialog';
import { Tenant, TenantStatus } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_STYLE: Record<TenantStatus, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: 'var(--surface-green-2)', color: 'var(--ink-green-3)', label: 'Ativo' },
  TRIAL: { bg: 'var(--surface-blue-2)', color: 'var(--ink-blue-3)', label: 'Trial' },
  SUSPENDED: { bg: 'var(--surface-amber-2)', color: 'var(--ink-amber-3)', label: 'Suspenso' },
  CANCELLED: { bg: 'var(--surface-red-2)', color: 'var(--ink-red-3)', label: 'Cancelado' },
};

function StatusBadge({ status }: { status: TenantStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.SUSPENDED;
  return (
    <span
      style={{
        backgroundColor: s.bg,
        color: s.color,
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '12px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {s.label}
    </span>
  );
}

// Modal de detalhes do tenant — abre ao clicar no card.
// Exibe os dados completos + codigo de acesso (HR-XXXXXX) com botao copiar.
function TenantDetailDialog({
  tenant,
  open,
  onOpenChange,
}: {
  tenant: Tenant | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!tenant) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // navigator.clipboard pode falhar em http sem contexto seguro — silencioso.
    }
  };

  const adminEmail = tenant.adminUser?.email ?? tenant.email ?? '—';
  const accessCode = tenant.adminUser?.accessCode ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: '560px' }}>
        <DialogHeader>
          <DialogTitle>{tenant.name}</DialogTitle>
          <DialogDescription>@{tenant.slug}</DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Codigo de acesso — destaque visual + botao copiar */}
          {accessCode && (
            <div
              style={{
                backgroundColor: 'var(--surface-blue-2)',
                border: '1px solid var(--outline-blue-2)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <KeyRound style={{ width: '16px', height: '16px', color: 'var(--ink-blue-3)' }} />
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--ink-blue-3)', margin: 0, fontWeight: 500 }}>
                    Código de acesso
                  </p>
                  <p
                    style={{
                      fontSize: '15px',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      color: 'var(--ink-gray-9)',
                      margin: '2px 0 0',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {accessCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(accessCode)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--outline-blue-2)',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  color: 'var(--ink-blue-3)',
                  cursor: 'pointer',
                }}
                aria-label="Copiar código de acesso"
              >
                {copied ? (
                  <>
                    <Check style={{ width: '14px', height: '14px' }} /> Copiado
                  </>
                ) : (
                  <>
                    <Copy style={{ width: '14px', height: '14px' }} /> Copiar
                  </>
                )}
              </button>
            </div>
          )}

          {/* Grid de campos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <DetailField label="Status" value={STATUS_STYLE[tenant.status]?.label ?? tenant.status} />
            <DetailField label="Plano" value={tenant.plan} />
            <DetailField label="Email do admin" value={adminEmail} />
            <DetailField
              label="WhatsApp"
              value={tenant.whatsappConnected ? 'Conectado' : 'Não configurado'}
            />
            <DetailField label="Usuários" value={String(tenant.userCount ?? 0)} />
            <DetailField label="Conversas" value={String(tenant.conversationCount ?? 0)} />
            {tenant.unitCount !== undefined && (
              <DetailField label="Unidades" value={String(tenant.unitCount)} />
            )}
            <DetailField label="Criado em" value={formatDate(tenant.createdAt)} />
          </div>

          {tenant.adminUser?.lastLoginAt && (
            <DetailField
              label="Último login do admin"
              value={formatDate(tenant.adminUser.lastLoginAt)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '11px', color: 'var(--ink-gray-5)', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '13px', color: 'var(--ink-gray-9)', margin: 0 }}>{value}</p>
    </div>
  );
}

export default function TenantsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => tenantService.list(),
  });

  const total = data?.pagination.total ?? 0;
  const tenants = data?.data ?? [];
  const activeCount = tenants.filter((t) => t.status === 'ACTIVE').length;
  const trialCount = tenants.filter((t) => t.status === 'TRIAL').length;
  const suspendedCount = tenants.filter((t) => t.status === 'SUSPENDED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--ink-gray-9)',
              margin: 0,
            }}
          >
            Tenants
          </h1>
          <p
            style={{
              fontSize: '13px',
              color: 'var(--ink-gray-5)',
              marginTop: '4px',
            }}
          >
            Gerencie todos os tenants (hotéis) do sistema
          </p>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          style={{
            backgroundColor: 'var(--surface-gray-7)',
            color: 'var(--surface-white)',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 500,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-gray-6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-gray-7)';
          }}
        >
          <Plus style={{ width: '14px', height: '14px' }} />
          Novo Tenant
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total de Tenants', value: total, icon: Building2 },
          { label: 'Ativos', value: activeCount, color: 'var(--ink-green-3)' },
          { label: 'Em Trial', value: trialCount, color: 'var(--ink-blue-3)' },
          { label: 'Suspensos', value: suspendedCount, color: 'var(--ink-amber-3)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: 'var(--surface-white)',
              border: '1px solid var(--outline-gray-1)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: '13px', color: 'var(--ink-gray-5)', margin: 0 }}>{label}</p>
              {Icon && (
                <Icon
                  style={{ width: '16px', height: '16px', color: 'var(--ink-gray-4)' }}
                />
              )}
            </div>
            <p
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: color ?? 'var(--ink-gray-9)',
                margin: 0,
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Tenant List */}
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 0',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '2px solid var(--outline-gray-2)',
              borderTopColor: 'var(--ink-gray-6)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedTenant(tenant)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedTenant(tenant);
                }
              }}
              style={{
                backgroundColor: 'var(--surface-white)',
                border: '1px solid var(--outline-gray-1)',
                borderRadius: '8px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                transition: 'border-color 0.15s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--outline-gray-2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--outline-gray-1)';
              }}
            >
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--surface-gray-2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Building2 style={{ width: '18px', height: '18px', color: 'var(--ink-gray-6)' }} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--ink-gray-9)',
                        margin: 0,
                      }}
                    >
                      {tenant.name}
                    </p>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--ink-gray-5)',
                        margin: '2px 0 0',
                      }}
                    >
                      @{tenant.slug}
                    </p>
                  </div>
                </div>
                <StatusBadge status={tenant.status} />
              </div>

              {/* Info rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--ink-gray-4)', margin: '0 0 2px' }}>
                    Email
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--ink-gray-8)', margin: 0 }}>
                    {tenant.adminUser?.email ?? tenant.email ?? '—'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: 'var(--ink-gray-4)', margin: '0 0 4px' }}>
                    Plano
                  </p>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--ink-gray-6)',
                      backgroundColor: 'var(--surface-gray-2)',
                    }}
                  >
                    {tenant.plan}
                  </span>
                </div>
              </div>

              {/* Counts */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users style={{ width: '14px', height: '14px', color: 'var(--ink-gray-5)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--ink-gray-6)' }}>
                    {tenant.userCount ?? 0} usuários
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MessageSquare style={{ width: '14px', height: '14px', color: 'var(--ink-gray-5)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--ink-gray-6)' }}>
                    {tenant.conversationCount ?? 0} conversas
                  </span>
                </div>
              </div>

              {/* WhatsApp status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: tenant.whatsappConnected
                      ? 'var(--ink-green-3)'
                      : 'var(--ink-gray-3)',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--ink-gray-5)' }}>
                  WhatsApp {tenant.whatsappConnected ? 'conectado' : 'não configurado'}
                </span>
              </div>

              {/* Footer com codigo de acesso + data */}
              <div
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid var(--outline-gray-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <p style={{ fontSize: '11px', color: 'var(--ink-gray-4)', margin: 0 }}>
                  Criado em {formatDate(tenant.createdAt)}
                </p>
                {tenant.adminUser?.accessCode && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      fontWeight: 500,
                      color: 'var(--ink-blue-3)',
                      backgroundColor: 'var(--surface-blue-2)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      letterSpacing: '0.3px',
                    }}
                    title="Código de acesso do admin"
                  >
                    {tenant.adminUser.accessCode}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <CreateTenantDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setIsCreateDialogOpen(false);
        }}
      />

      {/* Modal de detalhes — abre ao clicar num card. */}
      <TenantDetailDialog
        tenant={selectedTenant}
        open={selectedTenant !== null}
        onOpenChange={(v) => {
          if (!v) setSelectedTenant(null);
        }}
      />

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
