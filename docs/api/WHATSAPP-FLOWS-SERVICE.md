# WhatsApp Flows Service

Serviço para gerenciar WhatsApp Flows API - formulários nativos no WhatsApp com validação, campos customizados e navegação entre telas.

## Arquitetura

### Endpoints da Graph API (v21.0)

```
POST   /{WABA_ID}/flows              - Criar flow
POST   /{FLOW_ID}                    - Atualizar flow JSON
POST   /{FLOW_ID}/assets             - Upload de assets
POST   /{FLOW_ID}/publish            - Publicar flow
GET    /{FLOW_ID}                    - Obter detalhes
DELETE /{FLOW_ID}                    - Depreciar flow
GET    /{WABA_ID}/flows              - Listar flows
GET    /{FLOW_ID}/insights           - Métricas do flow
POST   /{PHONE_NUMBER_ID}/messages   - Enviar flow
```

### Multi-Tenant Security

- **TODAS as operações validam tenantId**
- Access token descriptografado por tenant
- WABA ID obtido do banco de dados por tenant
- Isolamento completo entre tenants

## Métodos do Serviço

### 1. createFlow

Cria um novo flow e atualiza com o JSON Schema.

```typescript
await whatsAppFlowsService.createFlow(
  tenantId: string,
  flowJson: object,
  name: string,
  categories?: string[]
): Promise<CreateFlowResult>
```

**Exemplo:**

```typescript
const flowJson = {
  version: "3.0",
  screens: [
    {
      id: "WELCOME",
      title: "Dados do Hóspede",
      data: {},
      layout: {
        type: "SingleColumnLayout",
        children: [
          {
            type: "TextInput",
            name: "nome",
            label: "Nome completo",
            required: true
          },
          {
            type: "TextInput",
            name: "email",
            label: "E-mail",
            input-type: "email",
            required: true
          },
          {
            type: "Footer",
            label: "Continuar",
            on-click-action: {
              name: "complete",
              payload: {
                screen: "WELCOME"
              }
            }
          }
        ]
      }
    }
  ]
};

const result = await whatsAppFlowsService.createFlow(
  tenantId,
  flowJson,
  "Cadastro de Hóspede",
  ["LEAD_GENERATION"]
);

console.log(result.flowId); // "123456789"
```

### 2. uploadFlowAssets

Upload de imagens, ícones e outros assets para o flow.

```typescript
await whatsAppFlowsService.uploadFlowAssets(
  tenantId: string,
  flowId: string,
  assets: FlowAsset[]
): Promise<{ success: boolean }>
```

**Exemplo:**

```typescript
await whatsAppFlowsService.uploadFlowAssets(
  tenantId,
  flowId,
  [
    {
      name: "logo",
      type: "MEDIA",
      url: "https://example.com/logo.png"
    },
    {
      name: "icon_check",
      type: "MEDIA",
      url: "https://example.com/check.png"
    }
  ]
);
```

### 3. publishFlow

Publica o flow (DRAFT → PUBLISHED). Só flows publicados podem ser enviados.

```typescript
await whatsAppFlowsService.publishFlow(
  tenantId: string,
  flowId: string
): Promise<PublishFlowResult>
```

**Exemplo:**

```typescript
const result = await whatsAppFlowsService.publishFlow(tenantId, flowId);

if (result.validationErrors && result.validationErrors.length > 0) {
  console.warn("Flow publicado com avisos:", result.validationErrors);
}
```

### 4. sendFlow

Envia o flow como mensagem interativa para um usuário.

```typescript
await whatsAppFlowsService.sendFlow(
  tenantId: string,
  phoneNumber: string,
  flowId: string,
  flowToken: string,
  ctaText: string,
  options?: {
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    flowCta?: 'navigate' | 'data_exchange';
    flowAction?: string;
    flowActionPayload?: object;
  }
): Promise<SendFlowResult>
```

**Exemplo:**

```typescript
const flowToken = `guest_${Date.now()}_${Math.random()}`;

await whatsAppFlowsService.sendFlow(
  tenantId,
  "5511999999999",
  flowId,
  flowToken,
  "Preencher Cadastro",
  {
    headerText: "Bem-vindo ao Hotel XYZ",
    bodyText: "Complete seu cadastro para finalizar a reserva",
    footerText: "Processo rápido e seguro",
    flowCta: "navigate",
    flowAction: "navigate",
    flowActionPayload: {
      screen: "WELCOME"
    }
  }
);
```

### 5. getFlowDetails

Obtém detalhes completos de um flow.

```typescript
await whatsAppFlowsService.getFlowDetails(
  tenantId: string,
  flowId: string
): Promise<FlowDetails>
```

**Exemplo:**

```typescript
const details = await whatsAppFlowsService.getFlowDetails(tenantId, flowId);

console.log({
  id: details.id,
  name: details.name,
  status: details.status, // DRAFT | PUBLISHED | DEPRECATED
  categories: details.categories,
  validationErrors: details.validation_errors
});
```

### 6. updateFlowJson

Atualiza o JSON de um flow existente (volta para DRAFT).

```typescript
await whatsAppFlowsService.updateFlowJson(
  tenantId: string,
  flowId: string,
  flowJson: object
): Promise<{ success: boolean }>
```

### 7. deprecateFlow

Deprecia um flow (soft delete - não pode mais ser enviado).

```typescript
await whatsAppFlowsService.deprecateFlow(
  tenantId: string,
  flowId: string
): Promise<{ success: boolean }>
```

### 8. listFlows

Lista todos os flows do tenant.

```typescript
await whatsAppFlowsService.listFlows(
  tenantId: string
): Promise<FlowDetails[]>
```

### 9. getFlowMetrics

Obtém métricas de uso de um flow.

```typescript
await whatsAppFlowsService.getFlowMetrics(
  tenantId: string,
  flowId: string
): Promise<any>
```

## Fluxo Completo de Criação

```typescript
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';

async function setupGuestRegistrationFlow(tenantId: string) {
  // 1. Criar flow
  const { flowId } = await whatsAppFlowsService.createFlow(
    tenantId,
    flowJsonSchema,
    "Cadastro de Hóspede",
    ["LEAD_GENERATION"]
  );

  // 2. Upload de assets (se houver)
  await whatsAppFlowsService.uploadFlowAssets(tenantId, flowId, [
    { name: "logo", type: "MEDIA", url: "https://..." }
  ]);

  // 3. Publicar
  const publishResult = await whatsAppFlowsService.publishFlow(tenantId, flowId);

  if (publishResult.validationErrors?.length > 0) {
    console.warn("Avisos de validação:", publishResult.validationErrors);
  }

  // 4. Enviar para um usuário
  const flowToken = `guest_${Date.now()}`;

  await whatsAppFlowsService.sendFlow(
    tenantId,
    "5511999999999",
    flowId,
    flowToken,
    "Preencher Cadastro",
    {
      bodyText: "Complete seu cadastro para finalizar a reserva"
    }
  );

  return flowId;
}
```

## Tratamento de Respostas (Webhook)

Quando o usuário completa o flow, o WhatsApp envia um webhook com o tipo `interactive`:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "5511999999999",
                "type": "interactive",
                "interactive": {
                  "type": "nfm_reply",
                  "nfm_reply": {
                    "response_json": "{\"nome\":\"João Silva\",\"email\":\"joao@example.com\"}",
                    "body": "Sent",
                    "name": "flow"
                  }
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Processar no webhook handler:**

```typescript
if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
  const responseData = JSON.parse(message.interactive.nfm_reply.response_json);

  console.log("Nome:", responseData.nome);
  console.log("Email:", responseData.email);

  // Processar dados do formulário...
}
```

## Exemplo de Flow JSON Schema

### Formulário Simples (1 tela)

```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "WELCOME",
      "title": "Dados do Hóspede",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "nome",
            "label": "Nome completo",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "email",
            "label": "E-mail",
            "input-type": "email",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "telefone",
            "label": "Telefone",
            "input-type": "phone",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Enviar",
            "on-click-action": {
              "name": "complete",
              "payload": {
                "screen": "WELCOME"
              }
            }
          }
        ]
      }
    }
  ]
}
```

### Formulário Multi-Step (navegação)

```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "WELCOME",
      "title": "Dados Pessoais",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "nome",
            "label": "Nome completo",
            "required": true
          },
          {
            "type": "DatePicker",
            "name": "data_nascimento",
            "label": "Data de nascimento",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Próximo",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONTATO"
              },
              "payload": {}
            }
          }
        ]
      }
    },
    {
      "id": "CONTATO",
      "title": "Informações de Contato",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "email",
            "label": "E-mail",
            "input-type": "email",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "telefone",
            "label": "Telefone",
            "input-type": "phone",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Voltar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "WELCOME"
              },
              "payload": {}
            }
          },
          {
            "type": "Footer",
            "label": "Finalizar",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

## Componentes Disponíveis

### Inputs
- **TextInput**: Texto livre (com tipos: text, email, phone, number, password)
- **TextArea**: Texto multi-linha
- **DatePicker**: Seletor de data
- **RadioButtonsGroup**: Opções exclusivas
- **CheckboxGroup**: Múltipla escolha
- **Dropdown**: Lista suspensa
- **OptIn**: Checkbox de aceitação

### Layout
- **TextHeading**: Título
- **TextBody**: Parágrafo
- **TextCaption**: Texto pequeno
- **Image**: Imagem
- **Footer**: Botões de ação

## Validações

O WhatsApp Flows valida automaticamente:
- Campos obrigatórios (required: true)
- Formato de email
- Formato de telefone
- Formato de número
- Comprimento mínimo/máximo

Validações customizadas podem ser adicionadas via:
- `min-chars` / `max-chars`
- `pattern` (regex)
- `helper-text` (texto de ajuda)
- `error-message` (mensagem de erro customizada)

## Limitações

- Máximo 10 telas por flow
- Máximo 50 componentes por tela
- Tamanho máximo do JSON: 100KB
- Assets devem ser HTTPS
- Imagens: máximo 5MB, formatos JPEG/PNG

## Error Handling

```typescript
try {
  await whatsAppFlowsService.publishFlow(tenantId, flowId);
} catch (error) {
  if (error instanceof BadRequestError) {
    // Erro de validação do flow
    console.error("Validação falhou:", error.message);
  } else if (error instanceof InternalServerError) {
    // Erro da API do WhatsApp
    console.error("Erro do WhatsApp:", error.message);
  } else {
    // Outros erros
    console.error("Erro inesperado:", error);
  }
}
```

## Referências

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Flow JSON Schema Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [Flow Components Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/components)
- [Flow Examples](https://developers.facebook.com/docs/whatsapp/flows/examples)

## Próximos Passos

1. Implementar endpoints REST no controller
2. Criar testes unitários
3. Adicionar exemplos de flows para o CRM (cadastro de hóspede, feedback, etc)
4. Implementar webhook handler para processar respostas
5. Criar UI no frontend para gerenciar flows
