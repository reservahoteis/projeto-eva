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
  Check,
  Clock,
  Copy,
  Eye,
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

type TabKey = 'history' | 'preview' | 'diff';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
      <PageHeader />

      <FlashBar errorMsg={errorMsg} successMsg={successMsg} />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: '16px', flex: 1, minHeight: 0 }}>
        {/* Coluna 1 — Lista de tenants */}
        <TenantPicker
          tenants={filteredTenants}
          selectedId={selectedTenantId}
          onSelect={setSelectedTenantId}
          search={tenantSearch}
          onSearchChange={setTenantSearch}
          isLoading={tenantsQ.isLoading}
        />

        {/* Coluna 2 — Editor + Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          {selectedTenantId === null ? (
            <EmptySelectionPlaceholder />
          ) : (
            <>
              <ActiveBar
                summary={selectedSummary?.tenantName}
                slug={selectedSummary?.tenantSlug}
                activeVersion={activeQ.data}
                isDirty={isDirty}
                isSaving={saveMut.isPending}
                onSave={() => saveMut.mutate()}
                onResetClick={() => setShowResetConfirm(true)}
              />

              <Editor
                value={editorText}
                onChange={setEditorText}
                changeNote={changeNote}
                onChangeNote={setChangeNote}
                isDirty={isDirty}
                textareaRef={editorRef}
              />

              <BottomTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                tenantId={selectedTenantId}
                editorText={editorText}
                isDirty={isDirty}
                versions={versionsQ.data ?? []}
                onActivateVersion={(vid) => activateMut.mutate(vid)}
                activatingId={activateMut.variables ?? null}
                activeVersionId={activeQ.data?.id ?? null}
              />
            </>
          )}
        </div>

        {/* Coluna 3 — Painel de variaveis */}
        <VariablesPanel
          systemVars={catalogQ.data?.systemVariables ?? []}
          customVars={catalogQ.data?.customVariables ?? []}
          onInsert={insertAtCursor}
          onManageCustom={() => setShowCustomVarsDialog(true)}
          disabled={selectedTenantId === null}
        />
      </div>

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

function TenantPicker({
  tenants,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  isLoading,
}: {
  tenants: ReturnType<typeof useQuery<unknown>>['data'] extends infer _D ? Array<{
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    activeVersionNumber: number | null;
    totalVersions: number;
  }> : never;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  isLoading: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '8px',
        padding: '12px',
        minHeight: 0,
      }}
    >
      <div style={{ position: 'relative' }}>
        <Search
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 14,
            height: 14,
            color: 'var(--ink-gray-5)',
          }}
        />
        <input
          type="text"
          placeholder="Buscar unidade..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px 6px 28px',
            fontSize: '13px',
            border: '1px solid var(--outline-gray-1)',
            borderRadius: '6px',
            outline: 'none',
            backgroundColor: 'var(--surface-gray-1)',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {isLoading ? (
          <p style={{ fontSize: 12, color: 'var(--ink-gray-5)', textAlign: 'center', marginTop: 16 }}>
            Carregando...
          </p>
        ) : (
          tenants?.map((t) => {
            const isSelected = t.tenantId === selectedId;
            return (
              <button
                key={t.tenantId}
                onClick={() => onSelect(t.tenantId)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--outline-blue-2)' : 'transparent',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? 'var(--surface-blue-2)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
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
                  @{t.tenantSlug}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-gray-5)' }}>
                  {t.activeVersionNumber === null
                    ? 'usando padrão'
                    : `v${t.activeVersionNumber} · ${t.totalVersions} versões`}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ActiveBar({
  summary,
  slug,
  activeVersion,
  isDirty,
  isSaving,
  onSave,
  onResetClick,
}: {
  summary: string | undefined;
  slug: string | undefined;
  activeVersion: BotPromptVersionDetail | undefined;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onResetClick: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '8px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-gray-9)', margin: 0 }}>
          {summary ?? '—'} <span style={{ color: 'var(--ink-gray-5)', fontWeight: 400 }}>@{slug}</span>
        </p>
        <p style={{ fontSize: 11, color: 'var(--ink-gray-5)', margin: '2px 0 0' }}>
          {activeVersion?.isSystemDefault
            ? 'Usando prompt padrão (sem versão própria)'
            : `Versão ativa: v${activeVersion?.versionNumber ?? '—'} · ${
                activeVersion?.createdAt ? formatDate(activeVersion.createdAt) : '—'
              }`}
          {isDirty && (
            <span style={{ marginLeft: 8, color: 'var(--ink-amber-3)', fontWeight: 600 }}>
              · alterações não salvas
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
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
          <Save style={{ width: 14, height: 14 }} /> {isSaving ? 'Salvando...' : 'Salvar versão'}
        </button>
      </div>
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
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '8px',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          flex: 1,
          width: '100%',
          padding: '14px',
          fontSize: 13,
          // Stack que prioriza Consolas (Windows) e Menlo (Mac) ANTES do
          // ui-monospace generico — sem isso, alguns browsers Windows caem
          // pra Courier New (legibilidade pessima criticada na review).
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

function VariablesPanel({
  systemVars,
  customVars,
  onInsert,
  onManageCustom,
  disabled,
}: {
  systemVars: SystemVariable[];
  customVars: CustomVariable[];
  onInsert: (s: string) => void;
  onManageCustom: () => void;
  disabled: boolean;
}) {
  const [filter, setFilter] = useState('');
  const fq = filter.toLowerCase();

  const sysReal = systemVars.filter((v) => !v.isRuntime);
  const sysRuntime = systemVars.filter((v) => v.isRuntime);

  const matches = (v: SystemVariable) =>
    !fq ||
    v.name.toLowerCase().includes(fq) ||
    v.description.toLowerCase().includes(fq) ||
    v.placeholder.toLowerCase().includes(fq);

  return (
    <div
      style={{
        backgroundColor: 'var(--surface-white)',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Variable style={{ width: 14, height: 14, color: 'var(--ink-gray-6)' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-gray-9)' }}>
          Variáveis
        </span>
      </div>

      <input
        type="text"
        placeholder="Filtrar variáveis..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          padding: '6px 8px',
          fontSize: 12,
          border: '1px solid var(--outline-gray-1)',
          borderRadius: 4,
          outline: 'none',
          backgroundColor: 'var(--surface-gray-1)',
        }}
      />

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <VarGroup
          title="Sistema (dados)"
          color="var(--ink-blue-3)"
          items={sysReal.filter(matches).map((v) => ({
            key: v.placeholder,
            primary: v.name,
            secondary: v.description,
            insertText: v.placeholder,
          }))}
          onInsert={onInsert}
          disabled={disabled}
        />
        <VarGroup
          title="Runtime N8N (literal)"
          color="var(--ink-amber-3)"
          items={sysRuntime.filter(matches).map((v) => ({
            key: v.placeholder,
            primary: v.name,
            secondary: v.description,
            insertText: v.placeholder,
          }))}
          onInsert={onInsert}
          disabled={disabled}
        />
        <VarGroup
          title="Customizadas"
          color="var(--ink-green-3)"
          headerAction={
            <button
              type="button"
              onClick={onManageCustom}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                fontSize: 12,
                border: '1px solid var(--ink-green-3)',
                borderRadius: 6,
                backgroundColor: 'var(--ink-green-3)',
                cursor: 'pointer',
                color: 'white',
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              }}
              title="Criar, editar ou deletar variáveis customizadas"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.filter = '';
              }}
            >
              <Settings2 style={{ width: 13, height: 13 }} />
              Gerenciar
            </button>
          }
          items={customVars
            .filter(
              (v) =>
                !fq ||
                v.varKey.toLowerCase().includes(fq) ||
                (v.description ?? '').toLowerCase().includes(fq),
            )
            .map((v) => ({
              key: v.id,
              primary: v.varKey,
              secondary: v.description ?? v.varType,
              insertText: `{{${v.varKey}}}`,
            }))}
          onInsert={onInsert}
          disabled={disabled}
          emptyHint='Nenhuma ainda. Clique "Gerenciar" para criar.'
        />
      </div>
    </div>
  );
}

function VarGroup({
  title,
  color,
  items,
  onInsert,
  disabled,
  emptyHint,
  headerAction,
}: {
  title: string;
  color: string;
  items: { key: string; primary: string; secondary: string; insertText: string }[];
  onInsert: (s: string) => void;
  disabled: boolean;
  emptyHint?: string;
  headerAction?: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '0 0 6px',
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color,
            margin: 0,
          }}
        >
          {title} ({items.length})
        </p>
        {headerAction}
      </div>
      {items.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--ink-gray-5)', margin: 0 }}>
          {emptyHint ?? 'Nenhum resultado.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => !disabled && onInsert(it.insertText)}
              disabled={disabled}
              title={it.secondary}
              style={{
                textAlign: 'left',
                padding: '5px 7px',
                fontSize: 12,
                border: '1px solid var(--outline-gray-1)',
                borderRadius: 4,
                backgroundColor: 'var(--surface-white)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                color: 'var(--ink-gray-9)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.backgroundColor = 'var(--surface-gray-2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-white)';
              }}
            >
              {it.primary}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BottomTabs({
  activeTab,
  onTabChange,
  tenantId,
  editorText,
  isDirty,
  versions,
  onActivateVersion,
  activatingId,
  activeVersionId,
}: {
  activeTab: TabKey;
  onTabChange: (t: TabKey) => void;
  tenantId: string;
  editorText: string;
  isDirty: boolean;
  versions: BotPromptVersion[];
  onActivateVersion: (id: string) => void;
  activatingId: string | null;
  activeVersionId: string | null;
}) {
  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[] = [
    { key: 'history', label: 'Histórico', icon: History },
    { key: 'preview', label: 'Preview', icon: Eye },
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
        maxHeight: '280px',
      }}
    >
      <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-gray-1)' }}>
        {tabs.map((t) => {
          const isActive = activeTab === t.key;
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
        {activeTab === 'history' && (
          <HistoryTab
            versions={versions}
            activeId={activeVersionId}
            onActivate={onActivateVersion}
            activatingId={activatingId}
          />
        )}
        {activeTab === 'preview' && (
          <PreviewTab tenantId={tenantId} editorText={editorText} isDirty={isDirty} />
        )}
        {activeTab === 'diff' && <DiffTab tenantId={tenantId} />}
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

function PreviewTab({
  tenantId,
  editorText,
  isDirty,
}: {
  tenantId: string;
  editorText: string;
  isDirty: boolean;
}) {
  // Quando o dev EDITOU o texto e ainda nao salvou (isDirty=true), o preview
  // mostra o RASCUNHO renderizado (POST /preview-draft com o texto do editor).
  // Quando nao ha edicoes pendentes, mostra a versao ativa persistida
  // (GET /preview da versao salva). Em ambos os casos as variaveis sao
  // resolvidas pelos valores reais do tenant — essa e a "moral do preview":
  // ver os valores reais ANTES de salvar, nao depois.
  const q = useQuery({
    queryKey: ['bot-prompts', isDirty ? 'preview-draft' : 'preview', tenantId, isDirty ? editorText : ''],
    queryFn: () =>
      isDirty
        ? botPromptService.previewDraft(tenantId, editorText)
        : botPromptService.preview(tenantId),
    // Pequeno staleTime evita refetch desnecessario enquanto a tab esta aberta.
    staleTime: 1000,
  });

  const [copied, setCopied] = useState(false);
  if (q.isLoading) return <p style={{ fontSize: 12, color: 'var(--ink-gray-5)' }}>Renderizando...</p>;
  if (!q.data) return <p style={{ fontSize: 12, color: 'var(--ink-gray-5)' }}>Sem dados.</p>;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(q.data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, color: 'var(--ink-gray-5)', margin: 0 }}>
          {isDirty ? (
            <>
              <strong style={{ color: 'var(--ink-amber-3)' }}>Rascunho</strong> · texto do
              editor renderizado em tempo real (não salvo ainda)
            </>
          ) : (
            <>
              v{q.data.versionNumber} · versão ativa renderizada (mesmo output que o N8N
              receberia)
            </>
          )}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: 11,
            border: '1px solid var(--outline-gray-2)',
            borderRadius: 4,
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-gray-8)',
          }}
        >
          {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre
        style={{
          fontSize: 11,
          fontFamily: 'Consolas, Menlo, Monaco, "Cascadia Code", monospace',
          margin: 0,
          padding: 10,
          backgroundColor: 'var(--surface-gray-1)',
          border: '1px solid var(--outline-gray-1)',
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--ink-gray-9)',
          maxHeight: 200,
          overflowY: 'auto',
        }}
      >
        {q.data.prompt}
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
