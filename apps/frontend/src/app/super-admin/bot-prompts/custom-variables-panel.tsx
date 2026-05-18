'use client';

// CRUD inline das variaveis customizadas — usada na aba "Variaveis customizadas"
// da pagina /super-admin/bot-prompts.
//
// Regras:
//   - var_key segue padrao [a-zA-Z0-9_], so e validado client-side (backend
//     tambem rejeita nomes que colidam com as 22 do sistema).
//   - var_type=static_global -> static_value obrigatorio.
//   - var_type=tenant_field -> field_source obrigatorio (allowlist no backend).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { botPromptService } from '@/services/bot-prompt.service';
import type { CustomVarType, CustomVariable } from '@/types/bot-prompt';

export function CustomVariablesPanel() {
  const queryClient = useQueryClient();
  const customQ = useQuery({
    queryKey: ['bot-prompts', 'custom-vars'],
    queryFn: () => botPromptService.listCustomVariables(),
  });

  const [showForm, setShowForm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => botPromptService.deleteCustomVariable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'custom-vars'] });
      queryClient.invalidateQueries({ queryKey: ['bot-prompts', 'catalog'] });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      setErrorMsg(err?.response?.data?.detail ?? 'Erro ao deletar');
      setTimeout(() => setErrorMsg(null), 3000);
    },
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--ink-gray-6)', margin: 0 }}>
          Variáveis criadas pelo time. Use <code>{'{{var_key}}'}</code> no prompt para inserir.
        </p>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 8px',
            fontSize: 11,
            border: '1px solid var(--outline-gray-2)',
            borderRadius: 4,
            backgroundColor: showForm ? 'var(--surface-gray-2)' : 'transparent',
            cursor: 'pointer',
            color: 'var(--ink-gray-8)',
          }}
        >
          <Plus style={{ width: 12, height: 12 }} />
          {showForm ? 'Cancelar' : 'Nova variável'}
        </button>
      </div>

      {errorMsg && (
        <p style={{ fontSize: 11, color: 'var(--ink-red-3)', margin: 0 }}>{errorMsg}</p>
      )}

      {showForm && <NewCustomVarForm onDone={() => setShowForm(false)} setErrorMsg={setErrorMsg} />}

      {customQ.isLoading ? (
        <p style={{ fontSize: 12, color: 'var(--ink-gray-5)' }}>Carregando...</p>
      ) : (customQ.data ?? []).length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--ink-gray-5)', margin: 0 }}>
          Nenhuma variável customizada ainda.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {customQ.data?.map((v) => (
            <CustomVarRow
              key={v.id}
              variable={v}
              onDelete={() => deleteMut.mutate(v.id)}
              isDeleting={deleteMut.isPending && deleteMut.variables === v.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomVarRow({
  variable,
  onDelete,
  isDeleting,
}: {
  variable: CustomVariable;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        border: '1px solid var(--outline-gray-1)',
        borderRadius: 4,
        backgroundColor: 'var(--surface-white)',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 500,
            color: 'var(--ink-gray-9)',
          }}
        >
          {`{{${variable.varKey}}}`}
          <span
            style={{
              marginLeft: 6,
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 3,
              backgroundColor: 'var(--surface-gray-2)',
              color: 'var(--ink-gray-6)',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            {variable.varType === 'static_global' ? 'estática' : 'tenant'}
          </span>
        </p>
        <p
          style={{
            margin: '2px 0 0',
            fontSize: 11,
            color: 'var(--ink-gray-5)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {variable.description ?? variable.staticValue ?? variable.fieldSource ?? '—'}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        style={{
          padding: 4,
          border: 'none',
          backgroundColor: 'transparent',
          cursor: isDeleting ? 'wait' : 'pointer',
          color: 'var(--ink-red-3)',
        }}
        aria-label="Deletar variável"
      >
        <Trash2 style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

function NewCustomVarForm({
  onDone,
  setErrorMsg,
}: {
  onDone: () => void;
  setErrorMsg: (m: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [varKey, setVarKey] = useState('');
  const [varType, setVarType] = useState<CustomVarType>('static_global');
  const [staticValue, setStaticValue] = useState('');
  const [fieldSource, setFieldSource] = useState('');
  const [description, setDescription] = useState('');

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
      onDone();
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { detail?: string } } };
      setErrorMsg(err?.response?.data?.detail ?? 'Erro ao criar variável');
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const validKey = /^[a-zA-Z0-9_]+$/.test(varKey);
  const canSubmit =
    varKey.length > 0 &&
    validKey &&
    ((varType === 'static_global' && staticValue.length > 0) ||
      (varType === 'tenant_field' && fieldSource.length > 0));

  return (
    <div
      style={{
        border: '1px solid var(--outline-blue-2)',
        backgroundColor: 'var(--surface-blue-2)',
        borderRadius: 4,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 8 }}>
        <input
          type="text"
          placeholder="var_key (ex: nome_da_marca)"
          value={varKey}
          onChange={(e) => setVarKey(e.target.value)}
          style={inputStyle}
        />
        <select
          value={varType}
          onChange={(e) => setVarType(e.target.value as CustomVarType)}
          style={inputStyle}
        >
          <option value="static_global">Estática</option>
          <option value="tenant_field">Campo do tenant</option>
        </select>
      </div>

      {varType === 'static_global' ? (
        <input
          type="text"
          placeholder="Valor fixo (será inserido literalmente)"
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

      {!validKey && varKey.length > 0 && (
        <p style={{ fontSize: 10, color: 'var(--ink-red-3)', margin: 0 }}>
          Use apenas letras, números e underscore.
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          type="button"
          onClick={onDone}
          style={{
            padding: '4px 10px',
            fontSize: 11,
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
          onClick={() => canSubmit && createMut.mutate()}
          disabled={!canSubmit || createMut.isPending}
          style={{
            padding: '4px 10px',
            fontSize: 11,
            border: 'none',
            borderRadius: 4,
            backgroundColor: canSubmit ? 'var(--ink-blue-3)' : 'var(--surface-gray-2)',
            color: canSubmit ? 'white' : 'var(--ink-gray-5)',
            cursor: canSubmit && !createMut.isPending ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          {createMut.isPending ? 'Criando...' : 'Criar'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 7px',
  fontSize: 12,
  border: '1px solid var(--outline-gray-1)',
  borderRadius: 4,
  outline: 'none',
  backgroundColor: 'var(--surface-white)',
  color: 'var(--ink-gray-9)',
};
