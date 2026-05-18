'use client';

// Dev Prompt Manager — pagina /super-admin/bot-prompts.
//
// Layout em 3 zonas:
//   - Top bar: seletor de unidade + versao ativa + acoes (Salvar, Resetar)
//   - Centro: editor de texto (CodeMirror-less, textarea com highlight via overlay)
//   - Direita: painel de variaveis (sistema/custom/runtime) — click insere no cursor
//
// Abas inferiores: Histórico, Preview renderizado, Diff vs padrão, Variáveis customizadas.
//
// Modelo de salvamento: cada "Salvar" cria nova versao no backend (cria_version)
// e ja vira a ativa. Lock otimista via expectedActiveVersion: o painel
// envia a versao que carregou; backend levanta 409 se outro dev mexeu.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Copy,
  GitCompare,
  History,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Variable,
} from 'lucide-react';
import { botPromptService } from '@/services/bot-prompt.service';
import type {
  BotPromptVersion,
  BotPromptVersionDetail,
  SystemVariable,
  CustomVariable,
} from '@/types/bot-prompt';
import { formatDate } from '@/lib/utils';
import { CustomVariablesDialog } from './custom-variables-dialog';

// Tabs auxiliares: preview agora vive ao lado do editor; restam Historico
// e Diff vs padrao.
type TabKey = 'history' | 'diff';

export default function BotPromptsPage() {
  const queryClient = useQueryClient();

  // --- State principal ---
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [editorText, setEditorText] = useState<string>('');
  const [changeNote, setChangeNote] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('history');
  const [tenantSearch, setTenantSearch] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showCustomVarsDialog, setShowCustomVarsDialog] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // --- Queries ---
  const tenantsQ = useQuery({
    queryKey: ['bot-prompts', 'tenants'],
    queryFn: () => botPromptService.listTenants(),
  });

  const activeQ = useQuery({
    queryKey: ['bot-prompts', 'active', selectedTenantId],
    queryFn: () => botPromptService.getActive(selectedTenantId!),
    enabled: !!selectedTenantId,
  });

  const versionsQ = useQuery({
    queryKey: ['bot-prompts', 'versions', selectedTenantId],
    queryFn: () => botPromptService.listVersions(selectedTenantId!),
    enabled: !!selectedTenantId,
  });

  const catalogQ = useQuery({
    queryKey: ['bot-prompts', 'catalog'],
    queryFn: () => botPromptService.getVariablesCatalog(),
  });

  // --- Sync editor com versao ativa ---
  // O effect carrega o texto APENAS quando o id da versao ativa muda
  // (troca de tenant ou versao). Refetch que devolve a MESMA versao nao
  // sobrescreve o que o dev esta digitando — controlado via ref ao inves
  // de mudar deps, para nao perder edicoes em flight.
  const lastLoadedVersionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const data = activeQ.data;
    if (data && data.id !== lastLoadedVersionIdRef.current) {
      lastLoadedVersionIdRef.current = data.id;
      setEditorText(data.templateText);
      setChangeNote('');
    }
  }, [activeQ.data]);

  // --- Filtragem de tenants pela busca ---
  const filteredTenants = useMemo(() => {
    const t = tenantsQ.data ?? [];
    if (!tenantSearch.trim()) return t;
    const q = tenantSearch.toLowerCase();
    return t.filter(
      (item) =>
        item.tenantName.toLowerCase().includes(q) ||
        item.tenantSlug.toLowerCase().includes(q),
    );
  }, [tenantsQ.data, tenantSearch]);

  // --- Sumario rapido ---
  const selectedSummary = useMemo(() => {
    return tenantsQ.data?.find((t) => t.tenantId === selectedTenantId);
  }, [tenantsQ.data, selectedTenantId]);

  const isDirty = activeQ.data ? editorText !== activeQ.data.templateText : false;

  // --- Mutations ---
  const saveMut = useMutation({
    mutationFn: () =>
      botPromptService.createVersion(selectedTenantId!, {
        templateText: editorText,
        changeNote: changeNote || undefined,
        expectedActiveVersion: activeQ.data?.isSystemDefault
          ? undefined
          : activeQ.data?.versionNumber,
      }),
    onSuccess: () => {
      flashSuccess('Versão salva e ativada');
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'active', selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'versions', selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'tenants'] });
    },
    onError: (e: unknown) => flashError(e),
  });

  const resetMut = useMutation({
    mutationFn: () =>
      botPromptService.resetToDefault(selectedTenantId!, {
        expectedActiveVersion: activeQ.data?.isSystemDefault
          ? undefined
          : activeQ.data?.versionNumber,
      }),
    onSuccess: () => {
      setShowResetConfirm(false);
      flashSuccess('Prompt restaurado para o padrão');
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'active', selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'versions', selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'tenants'] });
    },
    onError: (e: unknown) => {
      setShowResetConfirm(false);
      flashError(e);
    },
  });

  const activateMut = useMutation({
    mutationFn: (versionId: string) =>
      botPromptService.activateVersion(selectedTenantId!, versionId, {
        expectedActiveVersion: activeQ.data?.isSystemDefault
          ? undefined
          : activeQ.data?.versionNumber,
      }),
    onSuccess: () => {
      flashSuccess('Versão aplicada');
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'active', selectedTenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'versions', selectedTenantId] });
    },
    onError: (e: unknown) => flashError(e),
  });

  function flashSuccess(msg: string) {
    setErrorMsg(null);
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2500);
  }
  function flashError(e: unknown) {
    setSuccessMsg(null);
    let detail = 'Erro inesperado';
    const err = e as { response?: { data?: { detail?: string } }; message?: string };
    if (err?.response?.data?.detail) detail = err.response.data.detail;
    else if (err?.message) detail = err.message;
    setErrorMsg(detail);
    setTimeout(() => setErrorMsg(null), 5000);
  }

  // --- Helper: insere placeholder no cursor ---
  function insertAtCursor(text: string) {
    const ta = editorRef.current;
    if (!ta) {
      setEditorText((prev) => prev + text);
      return;
    }
    const start = ta.selectionStart ?? editorText.length;
    const end = ta.selectionEnd ?? editorText.length;
    const next = editorText.slice(0, start) + text + editorText.slice(end);
    setEditorText(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + text.length;
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
      <PageHeader />

      <FlashBar errorMsg={errorMsg} successMsg={successMsg} />

      {/* Top bar: tenant + variaveis + status + acoes */}
      <TopBar
        tenants={filteredTenants}
        tenantSearch={tenantSearch}
        onTenantSearchChange={setTenantSearch}
        selectedTenantId={selectedTenantId}
        onSelectTenant={setSelectedTenantId}
        tenantsLoading={tenantsQ.isLoading}
        activeVersion={activeQ.data}
        selectedSummary={selectedSummary}
        isDirty={isDirty}
        isSaving={saveMut.isPending}
        onSave={() => saveMut.mutate()}
        onResetClick={() => setShowResetConfirm(true)}
        systemVars={catalogQ.data?.systemVariables ?? []}
        customVars={catalogQ.data?.customVariables ?? []}
        onInsertVariable={insertAtCursor}
        onManageCustomVars={() => setShowCustomVarsDialog(true)}
      />

      {selectedTenantId === null ? (
        <EmptySelectionPlaceholder />
      ) : (
        <>
          {/* Editor + Preview lado a lado */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              flex: 1,
              minHeight: 0,
            }}
          >
            <Editor
              value={editorText}
              onChange={setEditorText}
              changeNote={changeNote}
              onChangeNote={setChangeNote}
              isDirty={isDirty}
              textareaRef={editorRef}
            />
            <LivePreview
              tenantId={selectedTenantId}
              editorText={editorText}
              isDirty={isDirty}
            />
          </div>

          {/* Tabs auxiliares (Historico + Diff) — bem mais compactas */}
          <SideTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tenantId={selectedTenantId}
            versions={versionsQ.data ?? []}
            onActivateVersion={(vid) => activateMut.mutate(vid)}
            activatingId={activateMut.variables ?? null}
            activeVersionId={activeQ.data?.id ?? null}
          />
        </>
      )}

      {showResetConfirm && (
        <ResetConfirmDialog
          tenantName={selectedSummary?.tenantName ?? ''}
          isLoading={resetMut.isPending}
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={() => resetMut.mutate()}
        />
      )}

      <CustomVariablesDialog
        open={showCustomVarsDialog}
        onOpenChange={setShowCustomVarsDialog}
      />
    </div>
  );
}

// ============================================================================
// Sub-componentes
// ============================================================================

function PageHeader() {
  return (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink-gray-9)', margin: 0 }}>
        Prompt do Smart Agent
      </h1>
      <p style={{ fontSize: '13px', color: 'var(--ink-gray-5)', margin: '4px 0 0' }}>
        Edite o prompt-mestre por unidade. Cada salvar cria uma nova versão (máx. 10 mantidas).
        Reset volta ao padrão do sistema a qualquer momento.
      </p>
    </div>
  );
}

function FlashBar({ errorMsg, successMsg }: { errorMsg: string | null; successMsg: string | null }) {
  if (!errorMsg && !successMsg) return null;
  const isError = !!errorMsg;
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
        backgroundColor: isError ? 'var(--surface-red-2)' : 'var(--surface-green-2)',
        color: isError ? 'var(--ink-red-3)' : 'var(--ink-green-3)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {isError ? <AlertTriangle style={{ width: 16, height: 16 }} /> : <Check style={{ width: 16, height: 16 }} />}
      {errorMsg ?? successMsg}
    </div>
  );
}

// ----------------------------------------------------------------------------
// TopBar — barra unica com tenant dropdown + variaveis popover + acoes
// ----------------------------------------------------------------------------

interface TopBarTenant {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  activeVersionNumber: number | null;
  totalVersions: number;
}

function TopBar({
  tenants,
  tenantSearch,
  onTenantSearchChange,
  selectedTenantId,
  onSelectTenant,
  tenantsLoading,
  activeVersion,
  selectedSummary,
  isDirty,
  isSaving,
  onSave,
  onResetClick,
  systemVars,
  customVars,
  onInsertVariable,
  onManageCustomVars,
}: {
  tenants: TopBarTenant[];
  tenantSearch: string;
  onTenantSearchChange: (v: string) => void;
  selectedTenantId: string | null;
  onSelectTenant: (id: string) => void;
  tenantsLoading: boolean;
  activeVersion: BotPromptVersionDetail | undefined;
  selectedSummary: TopBarTenant | undefined;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onResetClick: () => void;
  systemVars: SystemVariable[];
  customVars: CustomVariable[];
  onInsertVariable: (s: string) => void;
  onManageCustomVars: () => void;
}) {
  const [tenantOpen, setTenantOpen] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        position: 'relative',
        zIndex: 5,
      }}
    >
      {/* Tenant selector */}
      <TenantDropdown
        tenants={tenants}
        selectedId={selectedTenantId}
        onSelect={(id) => {
          onSelectTenant(id);
          setTenantOpen(false);
        }}
        search={tenantSearch}
        onSearchChange={onTenantSearchChange}
        isLoading={tenantsLoading}
        isOpen={tenantOpen}
        onToggle={() => setTenantOpen((v) => !v)}
        selectedSummary={selectedSummary}
      />

      {/* Variaveis */}
      <VariablesPopover
        systemVars={systemVars}
        customVars={customVars}
        onInsert={(s) => {
          onInsertVariable(s);
          // Mantem aberto pra inserir multiplas em sequencia
        }}
        onManageCustom={() => {
          setVarsOpen(false);
          onManageCustomVars();
        }}
        disabled={selectedTenantId === null}
        isOpen={varsOpen}
        onToggle={() => setVarsOpen((v) => !v)}
      />

      {/* Status da versao ativa (toma todo espaco que sobra) */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedTenantId === null ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-gray-5)' }}>
            Escolha uma unidade pra editar
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-gray-6)' }}>
            {activeVersion?.isSystemDefault
              ? 'Usando prompt padrão (sem versão própria)'
              : `Versão ativa: v${activeVersion?.versionNumber ?? '—'} · ${
                  activeVersion?.createdAt ? formatDate(activeVersion.createdAt) : '—'
                }`}
            {isDirty && (
              <span
                style={{
                  marginLeft: 8,
                  color: 'var(--ink-amber-3)',
                  fontWeight: 600,
                }}
              >
                · alterações não salvas
              </span>
            )}
          </p>
        )}
      </div>

      {/* Acoes */}
      {selectedTenantId !== null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onResetClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 13,
              border: '1px solid var(--outline-gray-2)',
              borderRadius: 6,
              backgroundColor: 'transparent',
              color: 'var(--ink-gray-8)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 14, height: 14 }} /> Resetar padrão
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: 13,
              border: 'none',
              borderRadius: 6,
              backgroundColor: isDirty ? 'var(--ink-blue-3)' : 'var(--surface-gray-2)',
              color: isDirty ? 'white' : 'var(--ink-gray-5)',
              cursor: isDirty && !isSaving ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            <Save style={{ width: 14, height: 14 }} />{' '}
            {isSaving ? 'Salvando...' : 'Salvar versão'}
          </button>
        </div>
      )}
    </div>
  );
}

function TenantDropdown({
  tenants,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  isLoading,
  isOpen,
  onToggle,
  selectedSummary,
}: {
  tenants: TopBarTenant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  selectedSummary: TopBarTenant | undefined;
}) {
  return (
    <div style={{ position: 'relative', minWidth: 240 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '7px 12px',
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--outline-gray-2)',
          borderRadius: 6,
          backgroundColor: 'var(--surface-white)',
          color: 'var(--ink-gray-9)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          textAlign: 'left',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          <Building2
            style={{
              width: 14,
              height: 14,
              display: 'inline',
              marginRight: 6,
              verticalAlign: -2,
              color: 'var(--ink-gray-6)',
            }}
          />
          {selectedSummary?.tenantName ?? 'Selecionar unidade'}
        </span>
        <ChevronDown style={{ width: 14, height: 14, color: 'var(--ink-gray-6)', flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 320,
            maxHeight: 380,
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-2)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
          }}
        >
          <div style={{ position: 'relative', padding: 8 }}>
            <Search
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 14,
                height: 14,
                color: 'var(--ink-gray-5)',
              }}
            />
            <input
              type="text"
              autoFocus
              placeholder="Buscar unidade..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 28px',
                fontSize: 13,
                border: '1px solid var(--outline-gray-1)',
                borderRadius: 6,
                outline: 'none',
                backgroundColor: 'var(--surface-gray-1)',
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {isLoading ? (
              <p style={{ fontSize: 12, color: 'var(--ink-gray-5)', textAlign: 'center', margin: 12 }}>
                Carregando...
              </p>
            ) : (
              tenants.map((t) => {
                const isSelected = t.tenantId === selectedId;
                return (
                  <button
                    key={t.tenantId}
                    onClick={() => onSelect(t.tenantId)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: '1px solid',
                      borderColor: isSelected ? 'var(--outline-blue-2)' : 'transparent',
                      borderRadius: 6,
                      backgroundColor: isSelected ? 'var(--surface-blue-2)' : 'transparent',
                      cursor: 'pointer',
                      marginBottom: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink-gray-9)' }}>
                      {t.tenantName}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-gray-5)' }}>
                      @{t.tenantSlug} ·{' '}
                      {t.activeVersionNumber === null
                        ? 'padrão'
                        : `v${t.activeVersionNumber} (${t.totalVersions} versões)`}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// VariablesPopover — botao + popover com as 3 categorias.  Cada item e
// CLICAVEL (insere no cursor) E DRAGGABLE (drop em qualquer textarea).
// ----------------------------------------------------------------------------

function VariablesPopover({
  systemVars,
  customVars,
  onInsert,
  onManageCustom,
  disabled,
  isOpen,
  onToggle,
}: {
  systemVars: SystemVariable[];
  customVars: CustomVariable[];
  onInsert: (s: string) => void;
  onManageCustom: () => void;
  disabled: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [filter, setFilter] = useState('');
  const fq = filter.toLowerCase();
  const sysReal = systemVars.filter((v) => !v.isRuntime);
  const sysRuntime = systemVars.filter((v) => v.isRuntime);

  const matchSys = (v: SystemVariable) =>
    !fq ||
    v.name.toLowerCase().includes(fq) ||
    v.description.toLowerCase().includes(fq) ||
    v.placeholder.toLowerCase().includes(fq);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        style={{
          padding: '7px 12px',
          fontSize: 13,
          fontWeight: 500,
          border: '1px solid var(--outline-gray-2)',
          borderRadius: 6,
          backgroundColor: isOpen ? 'var(--surface-gray-2)' : 'var(--surface-white)',
          color: disabled ? 'var(--ink-gray-5)' : 'var(--ink-gray-9)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
        title="Variáveis disponíveis (clique ou arraste para o editor)"
      >
        <Variable style={{ width: 14, height: 14 }} />
        Variáveis
        <ChevronDown style={{ width: 14, height: 14, color: 'var(--ink-gray-6)' }} />
      </button>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 420,
            maxHeight: 480,
            backgroundColor: 'var(--surface-white)',
            border: '1px solid var(--outline-gray-2)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: 10,
              borderBottom: '1px solid var(--outline-gray-1)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              type="text"
              autoFocus
              placeholder="Filtrar variáveis..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 12,
                border: '1px solid var(--outline-gray-1)',
                borderRadius: 4,
                outline: 'none',
                backgroundColor: 'var(--surface-gray-1)',
              }}
            />
            <button
              type="button"
              onClick={onManageCustom}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid var(--ink-green-3)',
                borderRadius: 6,
                backgroundColor: 'var(--ink-green-3)',
                color: 'white',
                cursor: 'pointer',
              }}
              title="Gerenciar variáveis customizadas (criar, editar, deletar)"
            >
              <Settings2 style={{ width: 12, height: 12 }} />
              Gerenciar
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <PopoverGroup
              title="Sistema (dados)"
              color="var(--ink-blue-3)"
              hint="Arraste ou clique pra inserir no cursor"
              items={sysReal.filter(matchSys).map((v) => ({
                key: v.placeholder,
                label: v.name,
                title: v.description,
                insertText: v.placeholder,
              }))}
              onInsert={onInsert}
            />
            <PopoverGroup
              title="Runtime N8N (literal)"
              color="var(--ink-amber-3)"
              hint="Estes placeholders ficam literais — N8N substitui na execução"
              items={sysRuntime.filter(matchSys).map((v) => ({
                key: v.placeholder,
                label: v.name,
                title: v.description,
                insertText: v.placeholder,
              }))}
              onInsert={onInsert}
            />
            <PopoverGroup
              title="Customizadas"
              color="var(--ink-green-3)"
              hint='Use "Gerenciar" pra criar/editar/deletar'
              items={customVars
                .filter(
                  (v) =>
                    !fq ||
                    v.varKey.toLowerCase().includes(fq) ||
                    (v.description ?? '').toLowerCase().includes(fq),
                )
                .map((v) => ({
                  key: v.id,
                  label: v.varKey,
                  title: v.description ?? v.varType,
                  insertText: `{{${v.varKey}}}`,
                }))}
              onInsert={onInsert}
              emptyHint='Nenhuma ainda — clique "Gerenciar" pra criar.'
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PopoverGroup({
  title,
  color,
  hint,
  items,
  onInsert,
  emptyHint,
}: {
  title: string;
  color: string;
  hint?: string;
  items: { key: string; label: string; title: string; insertText: string }[];
  onInsert: (s: string) => void;
  emptyHint?: string;
}) {
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color,
          }}
        >
          {title} ({items.length})
        </p>
        {hint && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-gray-5)' }}>{hint}</p>
        )}
      </div>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-gray-5)' }}>
          {emptyHint ?? 'Nenhum resultado.'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 4,
          }}
        >
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              draggable
              onClick={() => onInsert(it.insertText)}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', it.insertText);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              title={`${it.title}\n\n(arraste para soltar onde quiser, ou clique pra inserir no cursor)`}
              style={{
                textAlign: 'left',
                padding: '6px 9px',
                fontSize: 12,
                fontWeight: 500,
                border: '1px solid var(--outline-gray-1)',
                borderRadius: 4,
                backgroundColor: 'var(--surface-white)',
                color: 'var(--ink-gray-9)',
                cursor: 'grab',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-white)';
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Editor({
  value,
  onChange,
  changeNote,
  onChangeNote,
  isDirty,
  textareaRef,
}: {
  value: string;
  onChange: (v: string) => void;
  changeNote: string;
  onChangeNote: (v: string) => void;
  isDirty: boolean;
  textareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const [dragOver, setDragOver] = useState(false);

  // Drop handler — insere o texto arrastado (placeholder) na posicao do
  // CARET do textarea, nao na posicao do ponteiro. Por que: o user
  // costuma estar olhando pra onde o cursor esta. Comportamento default
  // do browser insere no ponto do drop (caractere mais proximo), que
  // pode parecer aleatorio. Preferimos a previsibilidade do caret.
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.getData('text/plain');
    if (!dropped) return;
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + dropped);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + dropped + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + dropped.length;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-white)',
        border: dragOver ? '2px dashed var(--ink-blue-3)' : '1px solid var(--outline-gray-1)',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: 0,
        transition: 'border-color 0.15s ease',
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--outline-gray-1)',
          backgroundColor: 'var(--surface-gray-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--ink-gray-8)' }}>
          Editor do prompt
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-gray-5)' }}>
          Clique ou arraste variáveis do painel acima
        </p>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => {
          // Default do browser bloqueia drop em textarea — precisamos
          // preventDefault aqui pra permitir o drop personalizado.
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          padding: '14px',
          fontSize: 13,
          fontFamily: 'Consolas, Menlo, Monaco, "Cascadia Code", "Source Code Pro", monospace',
          lineHeight: 1.55,
          border: 'none',
          outline: 'none',
          resize: 'none',
          color: 'var(--ink-gray-9)',
          backgroundColor: 'var(--surface-white)',
          minHeight: 0,
        }}
      />
      {isDirty && (
        <div
          style={{
            borderTop: '1px solid var(--outline-gray-1)',
            backgroundColor: 'var(--surface-gray-1)',
            padding: '8px 14px',
          }}
        >
          <input
            type="text"
            placeholder="Nota da versão (opcional, max 500 caracteres)"
            value={changeNote}
            onChange={(e) => onChangeNote(e.target.value)}
            maxLength={500}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: 12,
              border: '1px solid var(--outline-gray-1)',
              borderRadius: 4,
              outline: 'none',
              backgroundColor: 'var(--surface-white)',
            }}
          />
        </div>
      )}
    </div>
  );
}


// ----------------------------------------------------------------------------
// SideTabs — agora so Historico + Diff (preview ja vive ao lado do editor).
// Renderiza apenas a aba ativa pra economizar espaco vertical.
// ----------------------------------------------------------------------------

type SideTabKey = 'history' | 'diff';

function SideTabs({
  activeTab,
  onTabChange,
  tenantId,
  versions,
  onActivateVersion,
  activatingId,
  activeVersionId,
}: {
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
  tenantId: string;
  versions: BotPromptVersion[];
  onActivateVersion: (id: string) => void;
  activatingId: string | null;
  activeVersionId: string | null;
}) {
  // Normaliza: aceita 'preview' do estado legado (era uma tab), trata como historico.
  const safeTab: SideTabKey = activeTab === 'diff' ? 'diff' : 'history';
  const tabs: { key: SideTabKey; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
    { key: 'history', label: 'Histórico', icon: History },
    { key: 'diff', label: 'Diff vs padrão', icon: GitCompare },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 240,
      }}
    >
      <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-gray-1)' }}>
        {tabs.map((t) => {
          const isActive = safeTab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onTabChange(t.key)}
              style={{
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                border: 'none',
                borderBottom: isActive ? '2px solid var(--ink-blue-3)' : '2px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--ink-blue-3)' : 'var(--ink-gray-6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Icon style={{ width: 13, height: 13 } as React.CSSProperties} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {safeTab === 'history' && (
          <HistoryTab
            versions={versions}
            activeId={activeVersionId}
            onActivate={onActivateVersion}
            activatingId={activatingId}
          />
        )}
        {safeTab === 'diff' && <DiffTab tenantId={tenantId} />}
      </div>
    </div>
  );
}

function HistoryTab({
  versions,
  activeId,
  onActivate,
  activatingId,
}: {
  versions: BotPromptVersion[];
  activeId: string | null;
  onActivate: (id: string) => void;
  activatingId: string | null;
}) {
  if (versions.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--ink-gray-5)', margin: 0 }}>
        Nenhuma versão criada ainda — esta unidade usa o prompt padrão. Salve uma edição para
        começar a manter histórico.
      </p>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {versions.map((v) => {
        const isActive = v.id === activeId;
        const isActivating = activatingId === v.id;
        return (
          <div
            key={v.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              border: '1px solid var(--outline-gray-1)',
              borderRadius: 6,
              backgroundColor: isActive ? 'var(--surface-blue-2)' : 'var(--surface-white)',
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--ink-gray-9)' }}>
                v{v.versionNumber}
                {isActive && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 4,
                      backgroundColor: 'var(--ink-blue-3)',
                      color: 'white',
                    }}
                  >
                    ATIVA
                  </span>
                )}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-gray-5)' }}>
                <Clock style={{ width: 10, height: 10, display: 'inline', marginRight: 3 }} />
                {formatDate(v.createdAt)}
                {v.changeNote && ` · ${v.changeNote}`}
              </p>
            </div>
            {!isActive && (
              <button
                type="button"
                onClick={() => onActivate(v.id)}
                disabled={isActivating}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  border: '1px solid var(--outline-gray-2)',
                  borderRadius: 4,
                  backgroundColor: 'transparent',
                  color: 'var(--ink-gray-8)',
                  cursor: isActivating ? 'wait' : 'pointer',
                }}
              >
                {isActivating ? 'Aplicando...' : 'Aplicar'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// LivePreview — painel que vive ao lado do editor mostrando renderizacao
// real-time. Quando o editor esta sujo (isDirty), chama POST /preview-draft
// com o texto atual do editor; quando limpo, chama GET /preview da versao
// ativa salva.
// ----------------------------------------------------------------------------

function LivePreview({
  tenantId,
  editorText,
  isDirty,
}: {
  tenantId: string;
  editorText: string;
  isDirty: boolean;
}) {
  const q = useQuery({
    queryKey: [
      'bot-prompts',
      isDirty ? 'preview-draft' : 'preview',
      tenantId,
      isDirty ? editorText : '',
    ],
    queryFn: () =>
      isDirty
        ? botPromptService.previewDraft(tenantId, editorText)
        : botPromptService.preview(tenantId),
    staleTime: 800,
  });

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!q.data) return;
    try {
      await navigator.clipboard.writeText(q.data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: 8,
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--outline-gray-1)',
          backgroundColor: 'var(--surface-gray-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--ink-gray-8)' }}>
          Preview renderizado
          {q.data && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontWeight: 500,
                color: isDirty ? 'var(--ink-amber-3)' : 'var(--ink-gray-5)',
              }}
            >
              {isDirty
                ? '· rascunho (não salvo)'
                : `· v${q.data.versionNumber} ativa`}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!q.data}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            fontSize: 11,
            border: '1px solid var(--outline-gray-2)',
            borderRadius: 4,
            backgroundColor: 'transparent',
            cursor: q.data ? 'pointer' : 'not-allowed',
            color: 'var(--ink-gray-8)',
          }}
        >
          {copied ? (
            <Check style={{ width: 12, height: 12 }} />
          ) : (
            <Copy style={{ width: 12, height: 12 }} />
          )}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre
        style={{
          flex: 1,
          fontSize: 12,
          fontFamily: 'Consolas, Menlo, Monaco, "Cascadia Code", monospace',
          margin: 0,
          padding: 14,
          backgroundColor: 'var(--surface-white)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--ink-gray-9)',
          overflowY: 'auto',
          lineHeight: 1.55,
        }}
      >
        {q.isLoading
          ? 'Renderizando...'
          : q.data?.prompt ?? 'Sem dados.'}
      </pre>
    </div>
  );
}

function DiffTab({ tenantId }: { tenantId: string }) {
  const q = useQuery({
    queryKey: ['bot-prompts', 'diff', tenantId],
    queryFn: () => botPromptService.diff(tenantId, 'default'),
  });
  if (q.isLoading) return <p style={{ fontSize: 12, color: 'var(--ink-gray-5)' }}>Calculando diff...</p>;
  if (!q.data) return <p style={{ fontSize: 12, color: 'var(--ink-gray-5)' }}>Sem dados.</p>;
  if (!q.data.unifiedDiff)
    return (
      <p style={{ fontSize: 12, color: 'var(--ink-green-3)', margin: 0 }}>
        Sem diferenças — o prompt atual é idêntico ao padrão.
      </p>
    );

  return (
    <pre
      style={{
        fontSize: 12,
        fontFamily: 'Consolas, Menlo, Monaco, "Cascadia Code", monospace',
        margin: 0,
        padding: 10,
        backgroundColor: 'var(--surface-gray-1)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: 4,
        whiteSpace: 'pre',
        overflowX: 'auto',
        color: 'var(--ink-gray-9)',
        maxHeight: 200,
      }}
    >
      {q.data.unifiedDiff.split('\n').map((line, i) => {
        let color: string | undefined;
        if (line.startsWith('+++') || line.startsWith('---')) color = 'var(--ink-gray-6)';
        else if (line.startsWith('+')) color = 'var(--ink-green-3)';
        else if (line.startsWith('-')) color = 'var(--ink-red-3)';
        else if (line.startsWith('@@')) color = 'var(--ink-blue-3)';
        return (
          <div key={i} style={{ color }}>
            {line || ' '}
          </div>
        );
      })}
    </pre>
  );
}

function EmptySelectionPlaceholder() {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px dashed var(--outline-gray-2)',
        borderRadius: 8,
        padding: 40,
        textAlign: 'center',
        color: 'var(--ink-gray-5)',
        fontSize: 13,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      Selecione uma unidade à esquerda para editar o prompt.
    </div>
  );
}

function ResetConfirmDialog({
  tenantName,
  isLoading,
  onCancel,
  onConfirm,
}: {
  tenantName: string;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          backgroundColor: 'var(--surface-white)',
          borderRadius: 8,
          padding: 20,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--ink-gray-9)' }}>
          Resetar prompt para o padrão?
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-gray-6)', margin: '10px 0 18px' }}>
          Isso cria uma nova versão de <strong>{tenantName}</strong> com o conteúdo do system default.
          Suas versões anteriores ficam preservadas no histórico — você pode voltar a qualquer uma
          a qualquer momento.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: '1px solid var(--outline-gray-2)',
              borderRadius: 6,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              color: 'var(--ink-gray-8)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              border: 'none',
              borderRadius: 6,
              backgroundColor: 'var(--ink-red-3)',
              color: 'white',
              cursor: isLoading ? 'wait' : 'pointer',
              fontWeight: 600,
            }}
          >
            {isLoading ? 'Resetando...' : 'Resetar'}
          </button>
        </div>
      </div>
    </div>
  );
}
