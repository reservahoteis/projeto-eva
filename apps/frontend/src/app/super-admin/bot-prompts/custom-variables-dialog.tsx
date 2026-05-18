'use client';

// CRUD completo de variaveis customizadas (criar, listar, editar, deletar)
// num Dialog dedicado. Sempre acessivel pelo botao "Gerenciar variaveis" do
// painel direito — independente de qual tenant esta selecionado, ja que as
// variaveis customizadas sao GLOBAIS (compartilhadas entre todos os tenants).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { botPromptService } from '@/services/bot-prompt.service';
import type { CustomVarType, CustomVariable } from '@/types/bot-prompt';

export function CustomVariablesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CustomVariable | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const customQ = useQuery({
    queryKey: ['bot-prompts', 'custom-vars'],
    queryFn: () => botPromptService.listCustomVariables(),
    enabled: open,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => botPromptService.deleteCustomVariable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'custom-vars'] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'catalog'] });
    },
    onError: (e: unknown) => flashError(e, setErrorMsg),
  });

  function startEdit(v: CustomVariable) {
    setEditing(v);
    setShowForm(false);
  }
  function startNew() {
    setEditing(null);
    setShowForm(true);
  }
  function closeForm() {
    setEditing(null);
    setShowForm(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: 640 }}>
        <DialogHeader>
          <DialogTitle>Variáveis customizadas</DialogTitle>
          <DialogDescription>
            Variáveis globais (compartilhadas entre todos os tenants). Use{' '}
            <code>{'{{var_key}}'}</code> no prompt para inserir.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              backgroundColor: 'var(--surface-red-2)',
              color: 'var(--ink-red-3)',
              fontSize: 12,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={startNew}
            disabled={showForm}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 12px',
              fontSize: 12,
              border: '1px solid var(--outline-gray-2)',
              borderRadius: 6,
              backgroundColor: showForm ? 'var(--surface-gray-2)' : 'transparent',
              cursor: showForm ? 'not-allowed' : 'pointer',
              color: 'var(--ink-gray-8)',
            }}
          >
            <Plus style={{ width: 13, height: 13 }} />
            Nova variável
          </button>
        </div>

        {(showForm || editing) && (
          <CustomVarForm
            editing={editing}
            onCancel={closeForm}
            onSuccess={closeForm}
            onError={(e) => flashError(e, setErrorMsg)}
          />
        )}

        <div
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            border: '1px solid var(--outline-gray-1)',
            borderRadius: 6,
            padding: 8,
            backgroundColor: 'var(--surface-gray-1)',
          }}
        >
          {customQ.isLoading ? (
            <p style={{ fontSize: 12, color: 'var(--ink-gray-5)', textAlign: 'center', margin: 12 }}>
              Carregando...
            </p>
          ) : (customQ.data ?? []).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-gray-5)', textAlign: 'center', margin: 12 }}>
              Nenhuma variável customizada criada ainda.
            </p>
          ) : (
            customQ.data?.map((v) => (
              <VarRow
                key={v.id}
                variable={v}
                isEditing={editing?.id === v.id}
                onEdit={() => startEdit(v)}
                onDelete={() => deleteMut.mutate(v.id)}
                isDeleting={deleteMut.isPending && deleteMut.variables === v.id}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VarRow({
  variable,
  isEditing,
  onEdit,
  onDelete,
  isDeleting,
}: {
  variable: CustomVariable;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const valueOrSource =
    variable.varType === 'static_global' ? variable.staticValue : variable.fieldSource;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        border: '1px solid',
        borderColor: isEditing ? 'var(--outline-blue-2)' : 'var(--outline-gray-1)',
        borderRadius: 4,
        backgroundColor: isEditing ? 'var(--surface-blue-2)' : 'var(--surface-white)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontFamily: 'ui-monospace, monospace',
              fontWeight: 600,
              color: 'var(--ink-gray-9)',
            }}
          >
            {`{{${variable.varKey}}}`}
          </p>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 3,
              backgroundColor: 'var(--surface-gray-2)',
              color: 'var(--ink-gray-6)',
              fontWeight: 500,
            }}
          >
            {variable.varType === 'static_global' ? 'estática' : 'campo do tenant'}
          </span>
        </div>
        <p
          style={{
            margin: '3px 0 0',
            fontSize: 11,
            color: 'var(--ink-gray-5)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={variable.description ?? valueOrSource ?? ''}
        >
          {variable.description
            ? `${variable.description} · ${valueOrSource ?? ''}`
            : (valueOrSource ?? '—')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
        <button
          type="button"
          onClick={onEdit}
          style={iconBtnStyle('var(--ink-gray-7)')}
          aria-label="Editar variável"
          title="Editar"
        >
          <Pencil style={{ width: 13, height: 13 }} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          style={iconBtnStyle('var(--ink-red-3)')}
          aria-label="Deletar variável"
          title="Deletar"
        >
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
      </div>
    </div>
  );
}

function CustomVarForm({
  editing,
  onCancel,
  onSuccess,
  onError,
}: {
  editing: CustomVariable | null;
  onCancel: () => void;
  onSuccess: () => void;
  onError: (e: unknown) => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = editing !== null;

  const [varKey, setVarKey] = useState(editing?.varKey ?? '');
  const [varType, setVarType] = useState<CustomVarType>(editing?.varType ?? 'static_global');
  const [staticValue, setStaticValue] = useState(editing?.staticValue ?? '');
  const [fieldSource, setFieldSource] = useState(editing?.fieldSource ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');

  const createMut = useMutation({
    mutationFn: () =>
      botPromptService.createCustomVariable({
        varKey,
        varType,
        staticValue: varType === 'static_global' ? staticValue : undefined,
        fieldSource: varType === 'tenant_field' ? fieldSource : undefined,
        description: description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'custom-vars'] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'catalog'] });
      onSuccess();
    },
    onError,
  });

  const updateMut = useMutation({
    mutationFn: () =>
      botPromptService.updateCustomVariable(editing!.id, {
        // Backend mantem o tipo original — so atualiza payload do tipo
        // ja existente + descricao.
        staticValue: editing!.varType === 'static_global' ? staticValue : undefined,
        fieldSource: editing!.varType === 'tenant_field' ? fieldSource : undefined,
        description: description || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'custom-vars'] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'catalog'] });
      onSuccess();
    },
    onError,
  });

  const isPending = createMut.isPending || updateMut.isPending;
  const validKey = /^[a-zA-Z0-9_]+$/.test(varKey);
  const canSubmit =
    (isEdit ? true : varKey.length > 0 && validKey) &&
    ((varType === 'static_global' && staticValue.length > 0) ||
      (varType === 'tenant_field' && fieldSource.length > 0));

  return (
    <div
      style={{
        border: '1px solid var(--outline-blue-2)',
        backgroundColor: 'var(--surface-blue-2)',
        borderRadius: 6,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-blue-3)' }}>
          {isEdit ? `Editar ${editing!.varKey}` : 'Nova variável'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          style={iconBtnStyle('var(--ink-gray-6)')}
          aria-label="Fechar formulário"
        >
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8 }}>
        <input
          type="text"
          placeholder="var_key (ex: nome_da_marca)"
          value={varKey}
          onChange={(e) => setVarKey(e.target.value)}
          disabled={isEdit}
          style={{
            ...inputStyle,
            backgroundColor: isEdit ? 'var(--surface-gray-2)' : 'var(--surface-white)',
            color: isEdit ? 'var(--ink-gray-6)' : 'var(--ink-gray-9)',
            cursor: isEdit ? 'not-allowed' : 'text',
          }}
          title={isEdit ? 'var_key não pode ser alterada (delete e recrie)' : undefined}
        />
        <select
          value={varType}
          onChange={(e) => setVarType(e.target.value as CustomVarType)}
          disabled={isEdit}
          style={{
            ...inputStyle,
            backgroundColor: isEdit ? 'var(--surface-gray-2)' : 'var(--surface-white)',
            color: isEdit ? 'var(--ink-gray-6)' : 'var(--ink-gray-9)',
            cursor: isEdit ? 'not-allowed' : 'pointer',
          }}
        >
          <option value="static_global">Estática (valor fixo)</option>
          <option value="tenant_field">Campo do tenant</option>
        </select>
      </div>

      {varType === 'static_global' ? (
        <input
          type="text"
          placeholder="Valor (inserido literalmente no prompt)"
          value={staticValue}
          onChange={(e) => setStaticValue(e.target.value)}
          style={inputStyle}
        />
      ) : (
        <input
          type="text"
          placeholder="Origem (ex: tenant_onboardings.bot_name)"
          value={fieldSource}
          onChange={(e) => setFieldSource(e.target.value)}
          style={inputStyle}
        />
      )}

      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={inputStyle}
      />

      {!isEdit && !validKey && varKey.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--ink-red-3)', margin: 0 }}>
          Use apenas letras, números e underscore.
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          style={{
            padding: '5px 12px',
            fontSize: 12,
            border: '1px solid var(--outline-gray-2)',
            borderRadius: 4,
            backgroundColor: 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-gray-8)',
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            if (!canSubmit) return;
            if (isEdit) updateMut.mutate();
            else createMut.mutate();
          }}
          disabled={!canSubmit || isPending}
          style={{
            padding: '5px 12px',
            fontSize: 12,
            border: 'none',
            borderRadius: 4,
            backgroundColor: canSubmit ? 'var(--ink-blue-3)' : 'var(--surface-gray-2)',
            color: canSubmit ? 'white' : 'var(--ink-gray-5)',
            cursor: canSubmit && !isPending ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          {isPending ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </div>
  );
}

function flashError(e: unknown, setErrorMsg: (m: string | null) => void) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  const msg = err?.response?.data?.detail ?? err?.message ?? 'Erro inesperado';
  setErrorMsg(msg);
  setTimeout(() => setErrorMsg(null), 4000);
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 12,
  border: '1px solid var(--outline-gray-1)',
  borderRadius: 4,
  outline: 'none',
  backgroundColor: 'var(--surface-white)',
  color: 'var(--ink-gray-9)',
};

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    padding: 4,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    color,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
