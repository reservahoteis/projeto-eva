'use client';

// CRUD completo de variaveis customizadas (criar, listar, editar, deletar)
// num Dialog dedicado, com documentacao embutida pra reduzir chance de erro:
//   - Explicacao do que sao variaveis customizadas e quando usar
//   - Diferenca entre os 2 tipos (estatica vs campo do tenant)
//   - Lista das fontes permitidas pro tipo "campo do tenant" (allowlist do backend)
//   - Exemplos concretos pra cada tipo
//   - Validacao + mensagens claras
//
// As variaveis customizadas sao GLOBAIS (compartilhadas entre todos os tenants),
// por isso o dialog e acessivel independente de qual unidade esta selecionada
// na pagina principal.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Info,
  Lightbulb,
  Lock,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { botPromptService } from '@/services/bot-prompt.service';
import type { CustomVarType, CustomVariable } from '@/types/bot-prompt';

// ============================================================================
// Allowlist de fontes do tipo "tenant_field".
// Espelha o _TENANT_FIELD_ALLOWLIST do backend
// (app/services/bot_prompt_service.py). Qualquer valor fora desta lista e
// rejeitado silenciosamente no backend (defense-in-depth contra SQL injection).
// ============================================================================

const ALLOWED_TENANT_FIELDS: { value: string; label: string; example: string }[] = [
  { value: 'tenant.name', label: 'Nome do hotel', example: 'Hotel Santa' },
  { value: 'tenant.email', label: 'E-mail principal do tenant', example: 'contato@hotel.com' },
  { value: 'tenant.phone', label: 'Telefone do tenant', example: '+55 11 99999-9999' },
  { value: 'tenant.city', label: 'Cidade', example: 'São Paulo' },
  { value: 'tenant.state', label: 'Estado', example: 'SP' },
  { value: 'tenant_onboardings.bot_name', label: 'Nome do bot (onboarding)', example: 'Eva' },
];

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
  const [helpOpen, setHelpOpen] = useState(true);

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
      <DialogContent style={{ maxWidth: 760, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database style={{ width: 18, height: 18, color: 'var(--ink-green-3)' }} />
            Variáveis customizadas
          </DialogTitle>
          <DialogDescription>
            Crie placeholders próprios pra reutilizar no prompt de qualquer unidade. São <strong>globais</strong> —
            uma vez criadas, ficam disponíveis pra todos os hotéis.
          </DialogDescription>
        </DialogHeader>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <HelpSection open={helpOpen} onToggle={() => setHelpOpen(!helpOpen)} />

          {errorMsg && (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                backgroundColor: 'var(--surface-red-2)',
                color: 'var(--ink-red-3)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle style={{ width: 14, height: 14, marginTop: 1, flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-gray-9)' }}>
              {customQ.data?.length ?? 0} variável(is) criada(s)
            </p>
            <button
              type="button"
              onClick={startNew}
              disabled={showForm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 14px',
                fontSize: 13,
                border: 'none',
                borderRadius: 6,
                backgroundColor: showForm ? 'var(--surface-gray-2)' : 'var(--ink-blue-3)',
                color: showForm ? 'var(--ink-gray-5)' : 'white',
                fontWeight: 600,
                cursor: showForm ? 'not-allowed' : 'pointer',
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
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
              <p style={{ fontSize: 13, color: 'var(--ink-gray-5)', textAlign: 'center', margin: 16 }}>
                Carregando...
              </p>
            ) : (customQ.data ?? []).length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px 12px',
                  color: 'var(--ink-gray-5)',
                  fontSize: 13,
                }}
              >
                <p style={{ margin: 0, fontWeight: 500 }}>Nenhuma variável customizada ainda.</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>
                  Clique em <strong>Nova variável</strong> acima pra criar a primeira.
                </p>
              </div>
            ) : (
              customQ.data?.map((v) => (
                <VarRow
                  key={v.id}
                  variable={v}
                  isEditing={editing?.id === v.id}
                  onEdit={() => startEdit(v)}
                  onDelete={() => {
                    if (
                      confirm(
                        `Deletar a variável {{${v.varKey}}}?\n\n` +
                          `Prompts que ainda usem essa variável vão ficar com o placeholder ` +
                          `literal no texto renderizado (o resolver não encontra mais nada pra substituir).`,
                      )
                    ) {
                      deleteMut.mutate(v.id);
                    }
                  }}
                  isDeleting={deleteMut.isPending && deleteMut.variables === v.id}
                />
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Help section (collapsible)
// ============================================================================

function HelpSection({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div
      style={{
        border: '1px solid var(--outline-gray-2)',
        borderRadius: 8,
        backgroundColor: 'var(--surface-white)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: 'none',
          backgroundColor: 'transparent',
          cursor: 'pointer',
          color: 'var(--ink-gray-9)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {open ? (
          <ChevronDown style={{ width: 16, height: 16, color: 'var(--ink-gray-6)' }} />
        ) : (
          <ChevronRight style={{ width: 16, height: 16, color: 'var(--ink-gray-6)' }} />
        )}
        <Info style={{ width: 16, height: 16, color: 'var(--ink-blue-3)' }} />
        Como funciona — leia antes de criar a primeira
      </button>

      {open && (
        <div
          style={{
            padding: '4px 20px 20px',
            fontSize: 14,
            color: 'var(--ink-gray-8)',
            lineHeight: 1.65,
            borderTop: '1px solid var(--outline-gray-1)',
            marginTop: 4,
            paddingTop: 16,
          }}
        >
          <p style={{ margin: '0 0 16px' }}>
            Variáveis customizadas são placeholders <strong>seus</strong>, criados pelo time (as 22
            do sistema já vêm embutidas). Você escreve <code style={codeStyle}>{'{{nome_da_sua_var}}'}</code>{' '}
            dentro do prompt de qualquer unidade — quando o N8N pedir o prompt renderizado, o
            backend substitui pelo valor que você configurou aqui.
          </p>

          <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: 'var(--ink-gray-9)' }}>
            Os 2 tipos de variável
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {/* Tipo 1: estática */}
            <div
              style={{
                padding: 14,
                border: '1px solid var(--outline-gray-2)',
                borderRadius: 8,
                backgroundColor: 'var(--surface-gray-1)',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink-gray-9)' }}>
                1. Estática (valor fixo)
              </p>
              <p style={{ margin: '6px 0 10px', fontSize: 13, color: 'var(--ink-gray-7)' }}>
                Valor literal igual pra todos os hotéis.
              </p>
              <div style={exampleStyle}>
                <code style={codeStyle}>{'{{nome_da_rede}}'}</code> → &quot;Smart Hotéis Reserva&quot;
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-gray-6)' }}>
                Útil pra marca, slogan, instruções comuns, frases padrão.
              </p>
            </div>

            {/* Tipo 2: campo do tenant */}
            <div
              style={{
                padding: 14,
                border: '1px solid var(--outline-gray-2)',
                borderRadius: 8,
                backgroundColor: 'var(--surface-gray-1)',
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--ink-gray-9)' }}>
                2. Campo do tenant (valor por hotel)
              </p>
              <p style={{ margin: '6px 0 10px', fontSize: 13, color: 'var(--ink-gray-7)' }}>
                Pega um campo do banco específico do hotel ativo.
              </p>
              <div style={exampleStyle}>
                <code style={codeStyle}>{'{{cidade_hotel}}'}</code> → &quot;Ilhabela&quot; (hotel A)
                <br />
                <code style={codeStyle}>{'{{cidade_hotel}}'}</code> → &quot;Campos do Jordão&quot; (hotel B)
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--ink-gray-6)' }}>
                Útil pra cidade, telefone, e-mail, nome do bot etc.
              </p>
            </div>
          </div>

          {/* Lista de fontes permitidas */}
          <p
            style={{
              margin: '0 0 4px',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink-gray-9)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Lock style={{ width: 14, height: 14, color: 'var(--ink-gray-7)' }} />
            Fontes permitidas para &quot;Campo do tenant&quot;
          </p>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--ink-gray-6)' }}>
            Por segurança, só estes valores são aceitos no campo &quot;origem&quot;:
          </p>
          <div
            style={{
              border: '1px solid var(--outline-gray-2)',
              borderRadius: 6,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-gray-2)' }}>
                  <th style={tableHeadStyle}>Origem (cole exatamente)</th>
                  <th style={tableHeadStyle}>O que é</th>
                  <th style={tableHeadStyle}>Exemplo de valor</th>
                </tr>
              </thead>
              <tbody>
                {ALLOWED_TENANT_FIELDS.map((f, idx) => (
                  <tr
                    key={f.value}
                    style={{
                      backgroundColor:
                        idx % 2 === 0 ? 'var(--surface-white)' : 'var(--surface-gray-1)',
                    }}
                  >
                    <td style={tableCellStyle}>
                      <code style={codeStyle}>{f.value}</code>
                    </td>
                    <td style={tableCellStyle}>{f.label}</td>
                    <td style={{ ...tableCellStyle, color: 'var(--ink-gray-6)' }}>{f.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 6,
              backgroundColor: 'var(--surface-gray-1)',
              border: '1px solid var(--outline-gray-2)',
              fontSize: 13,
              color: 'var(--ink-gray-8)',
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              marginBottom: 20,
              lineHeight: 1.55,
            }}
          >
            <Lightbulb style={{ width: 16, height: 16, color: 'var(--ink-amber-3)', marginTop: 1, flexShrink: 0 }} />
            <span>
              <strong>Avançado:</strong> também aceita{' '}
              <code style={codeStyle}>tenant_onboardings.property_answers-&gt;&gt;&apos;N&apos;</code>{' '}
              onde N é o número de uma pergunta do wizard de onboarding (1..90). Ex.:{' '}
              <code style={codeStyle}>-&gt;&gt;&apos;1&apos;</code> devolve a primeira resposta da seção
              &quot;property&quot;.
            </span>
          </div>

          <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: 'var(--ink-gray-9)' }}>
            Regras importantes
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 22,
              fontSize: 13,
              color: 'var(--ink-gray-8)',
              lineHeight: 1.7,
            }}
          >
            <li>
              <strong>var_key</strong> só pode ter letras, números e underscore (sem espaço, sem
              hífen, sem acento).
            </li>
            <li>
              Nomes reservados pelo sistema (as 22 variáveis embutidas como{' '}
              <code style={codeStyle}>bot_name</code>, <code style={codeStyle}>orientacoes</code>{' '}
              etc.) são rejeitados.
            </li>
            <li>
              <strong>Não dá pra renomear</strong> depois de criar — vai quebrar todos os prompts
              que referenciam. Se errar o nome, delete e recrie.
            </li>
            <li>
              Editar muda apenas o <strong>valor</strong> (ou origem) e a descrição. O tipo é fixo
              após criação.
            </li>
            <li>
              Deletar é permanente. Prompts que ainda usem a variável ficam com o placeholder
              literal no texto renderizado (não quebra o bot — só fica feio).
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Linha de variável na lista
// ============================================================================

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
        padding: '10px 12px',
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
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--ink-blue-3)',
              letterSpacing: '-0.01em',
            }}
          >
            {`{{${variable.varKey}}}`}
          </p>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 3,
              backgroundColor:
                variable.varType === 'static_global' ? 'var(--surface-blue-2)' : 'var(--surface-amber-2)',
              color:
                variable.varType === 'static_global' ? 'var(--ink-blue-3)' : 'var(--ink-amber-3)',
              fontWeight: 600,
            }}
          >
            {variable.varType === 'static_global' ? 'ESTÁTICA' : 'CAMPO DO TENANT'}
          </span>
        </div>
        {variable.description && (
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--ink-gray-7)' }}>
            {variable.description}
          </p>
        )}
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 13,
            color: 'var(--ink-gray-6)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={valueOrSource ?? ''}
        >
          {variable.varType === 'static_global' ? '= ' : 'origem: '}
          {valueOrSource ?? '—'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
        <button
          type="button"
          onClick={onEdit}
          style={iconBtnStyle('var(--ink-gray-7)')}
          aria-label="Editar variável"
          title="Editar valor e descrição"
        >
          <Pencil style={{ width: 14, height: 14 }} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          style={iconBtnStyle('var(--ink-red-3)')}
          aria-label="Deletar variável"
          title="Deletar variável"
        >
          <Trash2 style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Formulario (cria/edita)
// ============================================================================

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

  // Preview do placeholder enquanto digita
  const previewKey = varKey || 'nome_da_var';

  return (
    <div
      style={{
        border: '2px solid var(--outline-blue-2)',
        backgroundColor: 'var(--surface-white)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink-blue-3)' }}>
          {isEdit ? `Editar ${editing!.varKey}` : 'Nova variável'}
        </p>
        <button
          type="button"
          onClick={onCancel}
          style={iconBtnStyle('var(--ink-gray-6)')}
          aria-label="Fechar formulário"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Campo 1: var_key */}
      <FormField
        label="Nome da variável (var_key)"
        hint={
          isEdit
            ? 'Não pode ser alterado — delete e recrie se precisar mudar o nome.'
            : 'Use letras, números e underscore. Será referenciado como {{nome_da_var}} no prompt.'
        }
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="ex: nome_da_marca"
            value={varKey}
            onChange={(e) => setVarKey(e.target.value)}
            disabled={isEdit}
            style={{
              ...inputStyle,
              backgroundColor: isEdit ? 'var(--surface-gray-2)' : 'var(--surface-white)',
              color: isEdit ? 'var(--ink-gray-6)' : 'var(--ink-gray-9)',
              cursor: isEdit ? 'not-allowed' : 'text',
            }}
          />
          <code
            style={{
              ...codeStyle,
              padding: '6px 10px',
              fontSize: 12,
              flexShrink: 0,
            }}
          >
            {`{{${previewKey}}}`}
          </code>
        </div>
        {!isEdit && !validKey && varKey.length > 0 && (
          <p style={errorHintStyle}>Use apenas letras, números e underscore (sem espaço/acento/hífen).</p>
        )}
      </FormField>

      {/* Campo 2: tipo */}
      <FormField
        label="Tipo da variável"
        hint={
          isEdit
            ? 'Tipo não pode ser alterado — delete e recrie se precisar trocar.'
            : 'Estática = valor fixo igual pra todos os hotéis. Campo do tenant = valor específico de cada hotel.'
        }
      >
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
          <option value="tenant_field">Campo do tenant (valor por hotel)</option>
        </select>
      </FormField>

      {/* Campo 3: valor (depende do tipo) */}
      {varType === 'static_global' ? (
        <FormField
          label="Valor"
          hint="Será inserido literalmente toda vez que o placeholder aparecer no prompt."
        >
          <input
            type="text"
            placeholder="ex: Smart Hotéis Reserva"
            value={staticValue}
            onChange={(e) => setStaticValue(e.target.value)}
            style={inputStyle}
          />
        </FormField>
      ) : (
        <FormField
          label="Origem (campo do banco)"
          hint="Selecione um dos campos da lista. Não escreva à mão — qualquer outro valor é rejeitado pelo backend."
        >
          <select
            value={fieldSource}
            onChange={(e) => setFieldSource(e.target.value)}
            style={inputStyle}
          >
            <option value="">— escolha um campo —</option>
            {ALLOWED_TENANT_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} ({f.value})
              </option>
            ))}
          </select>
          <details style={{ marginTop: 6 }}>
            <summary style={{ fontSize: 11, color: 'var(--ink-gray-6)', cursor: 'pointer' }}>
              Quero usar uma resposta específica do wizard (avançado)
            </summary>
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-gray-7)' }}>
                Cole o caminho no formato <code style={codeStyle}>tenant_onboardings.property_answers-&gt;&gt;&apos;N&apos;</code>{' '}
                onde N é o número da pergunta (1..90). Exemplo: <code style={codeStyle}>tenant_onboardings.property_answers-&gt;&gt;&apos;1&apos;</code>{' '}
                = primeira resposta da seção &quot;property&quot;.
              </p>
              <input
                type="text"
                placeholder="tenant_onboardings.property_answers->>'1'"
                value={fieldSource}
                onChange={(e) => setFieldSource(e.target.value)}
                style={inputStyle}
              />
            </div>
          </details>
        </FormField>
      )}

      {/* Campo 4: descrição */}
      <FormField label="Descrição (opcional)" hint="Texto curto pra ajudar o próximo dev a entender o que essa variável faz.">
        <input
          type="text"
          placeholder="ex: Nome comercial da rede de hotéis"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={inputStyle}
        />
      </FormField>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          style={{
            padding: '7px 14px',
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
          onClick={() => {
            if (!canSubmit) return;
            if (isEdit) updateMut.mutate();
            else createMut.mutate();
          }}
          disabled={!canSubmit || isPending}
          style={{
            padding: '7px 14px',
            fontSize: 13,
            border: 'none',
            borderRadius: 6,
            backgroundColor: canSubmit ? 'var(--ink-blue-3)' : 'var(--surface-gray-2)',
            color: canSubmit ? 'white' : 'var(--ink-gray-5)',
            cursor: canSubmit && !isPending ? 'pointer' : 'not-allowed',
            fontWeight: 600,
          }}
        >
          {isPending ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar variável'}
        </button>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-gray-9)' }}>{label}</label>
      {children}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  );
}

// ============================================================================
// Helpers + Styles
// ============================================================================

function flashError(e: unknown, setErrorMsg: (m: string | null) => void) {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  const msg = err?.response?.data?.detail ?? err?.message ?? 'Erro inesperado';
  setErrorMsg(msg);
  setTimeout(() => setErrorMsg(null), 5000);
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  fontSize: 13,
  border: '1px solid var(--outline-gray-1)',
  borderRadius: 4,
  outline: 'none',
  backgroundColor: 'var(--surface-white)',
  color: 'var(--ink-gray-9)',
};

// Snippets curtos inline: usa a Inter (fonte principal do app) com peso
// bold e cor azul. Decidimos NAO usar monospace aqui porque ui-monospace
// no Windows cai pra Courier New (legibilidade pessima); a Inter
// destacada por cor+peso preenche a mesma funcao visual com legibilidade
// muito melhor.
const codeStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.92em',
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 4,
  backgroundColor: 'var(--surface-gray-2)',
  color: 'var(--ink-blue-3)',
  letterSpacing: '-0.01em',
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: 'var(--ink-gray-6)',
  lineHeight: 1.4,
};

const errorHintStyle: React.CSSProperties = {
  margin: '2px 0 0',
  fontSize: 11,
  color: 'var(--ink-red-3)',
  fontWeight: 500,
};

const exampleStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: 6,
  backgroundColor: 'var(--surface-white)',
  border: '1px solid var(--outline-gray-2)',
  fontSize: 13,
  color: 'var(--ink-gray-8)',
  lineHeight: 1.7,
};

const tableHeadStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '5px 8px',
  fontWeight: 600,
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  color: 'var(--ink-gray-7)',
  borderBottom: '1px solid var(--outline-gray-2)',
};

const tableCellStyle: React.CSSProperties = {
  padding: '5px 8px',
  borderBottom: '1px solid var(--outline-gray-1)',
  verticalAlign: 'top',
  color: 'var(--ink-gray-8)',
};

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    padding: 6,
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
