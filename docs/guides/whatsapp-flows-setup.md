# Guia de Setup: WhatsApp Flows

Este guia mostra como configurar e usar WhatsApp Flows no CRM de hotéis para criar formulários nativos no WhatsApp.

## Pré-requisitos

1. Conta WhatsApp Business Account configurada
2. `whatsappBusinessAccountId` configurado no tenant
3. `whatsappAccessToken` configurado e criptografado
4. `whatsappPhoneNumberId` configurado

## Caso de Uso: Formulário de Cadastro de Hóspede

### 1. JSON Schema do Flow

Crie o arquivo `flows/guest-registration.json`:

```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "PERSONAL_DATA",
      "title": "Dados Pessoais",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Complete seu cadastro"
          },
          {
            "type": "TextBody",
            "text": "Precisamos de alguns dados para finalizar sua reserva."
          },
          {
            "type": "TextInput",
            "name": "nome_completo",
            "label": "Nome completo",
            "required": true,
            "min-chars": 3,
            "max-chars": 100,
            "helper-text": "Nome conforme documento"
          },
          {
            "type": "TextInput",
            "name": "cpf",
            "label": "CPF",
            "required": true,
            "input-type": "number",
            "pattern": "[0-9]{11}",
            "helper-text": "Apenas números"
          },
          {
            "type": "DatePicker",
            "name": "data_nascimento",
            "label": "Data de nascimento",
            "required": true,
            "min-date": "1900-01-01",
            "max-date": "2010-12-31"
          },
          {
            "type": "Footer",
            "label": "Próximo",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONTACT_INFO"
              },
              "payload": {}
            }
          }
        ]
      }
    },
    {
      "id": "CONTACT_INFO",
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
            "type": "TextInput",
            "name": "cep",
            "label": "CEP",
            "input-type": "number",
            "required": true,
            "pattern": "[0-9]{8}"
          },
          {
            "type": "Footer",
            "label": "Voltar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "PERSONAL_DATA"
              },
              "payload": {}
            }
          },
          {
            "type": "Footer",
            "label": "Próximo",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "PREFERENCES"
              },
              "payload": {}
            }
          }
        ]
      }
    },
    {
      "id": "PREFERENCES",
      "title": "Preferências",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Como podemos melhorar sua experiência?"
          },
          {
            "type": "RadioButtonsGroup",
            "name": "tipo_quarto",
            "label": "Preferência de quarto",
            "required": true,
            "data-source": [
              {
                "id": "standard",
                "title": "Standard"
              },
              {
                "id": "deluxe",
                "title": "Deluxe"
              },
              {
                "id": "suite",
                "title": "Suíte"
              }
            ]
          },
          {
            "type": "CheckboxGroup",
            "name": "servicos_extras",
            "label": "Serviços extras (opcional)",
            "data-source": [
              {
                "id": "cafe_quarto",
                "title": "Café da manhã no quarto"
              },
              {
                "id": "transfer",
                "title": "Transfer aeroporto"
              },
              {
                "id": "spa",
                "title": "Sessão de SPA"
              }
            ]
          },
          {
            "type": "TextArea",
            "name": "observacoes",
            "label": "Observações (opcional)",
            "max-chars": 500
          },
          {
            "type": "OptIn",
            "name": "aceita_termos",
            "label": "Li e aceito os termos de uso",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Voltar",
            "on-click-action": {
              "name": "navigate",
              "next": {
                "type": "screen",
                "name": "CONTACT_INFO"
              },
              "payload": {}
            }
          },
          {
            "type": "Footer",
            "label": "Enviar",
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

### 2. Script de Setup

Crie o arquivo `scripts/setup-guest-flow.ts`:

```typescript
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';
import guestRegistrationFlow from '../flows/guest-registration.json';

async function setupGuestRegistrationFlow(tenantId: string) {
  console.log('Creating guest registration flow...');

  // 1. Criar o flow
  const { flowId } = await whatsAppFlowsService.createFlow(
    tenantId,
    guestRegistrationFlow,
    'Cadastro de Hóspede',
    ['LEAD_GENERATION']
  );

  console.log(`Flow created with ID: ${flowId}`);

  // 2. Upload de assets (se houver)
  // Neste exemplo, não temos imagens, mas seria assim:
  /*
  await whatsAppFlowsService.uploadFlowAssets(tenantId, flowId, [
    {
      name: 'hotel_logo',
      type: 'MEDIA',
      url: 'https://example.com/logo.png'
    }
  ]);
  */

  // 3. Publicar o flow
  console.log('Publishing flow...');
  const publishResult = await whatsAppFlowsService.publishFlow(tenantId, flowId);

  if (publishResult.validationErrors && publishResult.validationErrors.length > 0) {
    console.warn('Flow published with warnings:', publishResult.validationErrors);
  } else {
    console.log('Flow published successfully!');
  }

  // 4. Salvar flowId no tenant (opcional - para reutilizar)
  // await prisma.tenant.update({
  //   where: { id: tenantId },
  //   data: { bookingFlowId: flowId }
  // });

  return flowId;
}

// Executar
const tenantId = process.argv[2];

if (!tenantId) {
  console.error('Usage: pnpm tsx scripts/setup-guest-flow.ts <tenantId>');
  process.exit(1);
}

setupGuestRegistrationFlow(tenantId)
  .then((flowId) => {
    console.log(`\nFlow setup complete! Flow ID: ${flowId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error setting up flow:', error);
    process.exit(1);
  });
```

### 3. Enviar Flow para Usuário

No seu código do CRM, quando o usuário solicitar orçamento:

```typescript
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';

async function sendGuestRegistrationFlow(
  tenantId: string,
  contactPhone: string,
  flowId: string
) {
  // Token único para identificar a sessão
  const flowToken = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Enviar flow
  await whatsAppFlowsService.sendFlow(
    tenantId,
    contactPhone,
    flowId,
    flowToken,
    'Preencher Cadastro',
    {
      headerText: 'Bem-vindo ao Hotel',
      bodyText: 'Complete seu cadastro em poucos passos para finalizar sua reserva',
      footerText: 'Processo rápido e seguro',
      flowCta: 'navigate',
      flowAction: 'navigate',
      flowActionPayload: {
        screen: 'PERSONAL_DATA'
      }
    }
  );

  console.log(`Flow sent to ${contactPhone} with token: ${flowToken}`);
  return flowToken;
}
```

### 4. Processar Resposta (Webhook)

No webhook handler, processe a resposta do flow:

```typescript
// No arquivo de webhook handler (ex: whatsapp.webhook.ts)

if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
  const responseJson = message.interactive.nfm_reply.response_json;
  const guestData = JSON.parse(responseJson);

  console.log('Guest registration data received:', {
    nome: guestData.nome_completo,
    cpf: guestData.cpf,
    email: guestData.email,
    telefone: guestData.telefone,
    tipoQuarto: guestData.tipo_quarto,
    servicosExtras: guestData.servicos_extras,
    observacoes: guestData.observacoes
  });

  // Processar dados...
  await processGuestRegistration(tenantId, contactId, guestData);

  // Enviar confirmação
  await whatsAppService.sendTextMessage(
    tenantId,
    message.from,
    `Obrigado, ${guestData.nome_completo}! Seu cadastro foi concluído com sucesso. Em breve entraremos em contato para confirmar sua reserva.`
  );
}
```

### 5. Estrutura da Resposta

A resposta do flow terá esta estrutura:

```json
{
  "nome_completo": "João Silva",
  "cpf": "12345678901",
  "data_nascimento": "1990-05-15",
  "email": "joao@example.com",
  "telefone": "+5511999999999",
  "cep": "01310100",
  "tipo_quarto": "deluxe",
  "servicos_extras": ["cafe_quarto", "transfer"],
  "observacoes": "Preferência por andar alto",
  "aceita_termos": true
}
```

## Caso de Uso: Formulário de Feedback

Flow simples de 1 tela para coletar feedback após check-out:

```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "FEEDBACK",
      "title": "Como foi sua estadia?",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextBody",
            "text": "Sua opinião é muito importante para nós!"
          },
          {
            "type": "RadioButtonsGroup",
            "name": "avaliacao_geral",
            "label": "Avaliação geral",
            "required": true,
            "data-source": [
              { "id": "5", "title": "⭐⭐⭐⭐⭐ Excelente" },
              { "id": "4", "title": "⭐⭐⭐⭐ Muito bom" },
              { "id": "3", "title": "⭐⭐⭐ Bom" },
              { "id": "2", "title": "⭐⭐ Regular" },
              { "id": "1", "title": "⭐ Ruim" }
            ]
          },
          {
            "type": "RadioButtonsGroup",
            "name": "limpeza",
            "label": "Limpeza",
            "required": true,
            "data-source": [
              { "id": "5", "title": "Excelente" },
              { "id": "4", "title": "Muito bom" },
              { "id": "3", "title": "Bom" },
              { "id": "2", "title": "Regular" },
              { "id": "1", "title": "Ruim" }
            ]
          },
          {
            "type": "RadioButtonsGroup",
            "name": "atendimento",
            "label": "Atendimento",
            "required": true,
            "data-source": [
              { "id": "5", "title": "Excelente" },
              { "id": "4", "title": "Muito bom" },
              { "id": "3", "title": "Bom" },
              { "id": "2", "title": "Regular" },
              { "id": "1", "title": "Ruim" }
            ]
          },
          {
            "type": "TextArea",
            "name": "comentarios",
            "label": "Comentários adicionais (opcional)",
            "max-chars": 500,
            "helper-text": "O que podemos melhorar?"
          },
          {
            "type": "RadioButtonsGroup",
            "name": "recomendaria",
            "label": "Recomendaria nosso hotel?",
            "required": true,
            "data-source": [
              { "id": "sim", "title": "Sim" },
              { "id": "nao", "title": "Não" },
              { "id": "talvez", "title": "Talvez" }
            ]
          },
          {
            "type": "Footer",
            "label": "Enviar Feedback",
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

## Boas Práticas

### 1. Flow Token

Use tokens únicos e informativos:

```typescript
const flowToken = `${purpose}_${tenantId.slice(0,8)}_${Date.now()}_${randomStr}`;
// Exemplo: "guest_abc123_1706800000_x7k9"
```

### 2. Validação de Dados

Sempre valide os dados recebidos do flow:

```typescript
import { z } from 'zod';

const guestDataSchema = z.object({
  nome_completo: z.string().min(3).max(100),
  cpf: z.string().regex(/^\d{11}$/),
  email: z.string().email(),
  telefone: z.string(),
  aceita_termos: z.literal(true)
});

try {
  const validatedData = guestDataSchema.parse(guestData);
  // Processar dados validados...
} catch (error) {
  logger.error({ error, guestData }, 'Invalid guest data received');
  // Notificar usuário sobre erro...
}
```

### 3. Error Handling

```typescript
try {
  await whatsAppFlowsService.sendFlow(...);
} catch (error) {
  if (error instanceof BadRequestError) {
    // Flow não publicado ou configuração inválida
    logger.error('Flow configuration error:', error.message);
    // Fallback: enviar formulário via mensagens normais
    await sendManualForm(tenantId, contactPhone);
  } else {
    // Erro inesperado
    logger.error('Unexpected error sending flow:', error);
    throw error;
  }
}
```

### 4. Monitoramento

```typescript
// Após enviar flow, registrar no banco
await prisma.flowSession.create({
  data: {
    tenantId,
    contactId,
    flowId,
    flowToken,
    status: 'SENT',
    sentAt: new Date()
  }
});

// Quando receber resposta
await prisma.flowSession.update({
  where: { flowToken },
  data: {
    status: 'COMPLETED',
    completedAt: new Date(),
    responseData: guestData
  }
});
```

## Comandos Úteis

```bash
# Setup flow
pnpm tsx scripts/setup-guest-flow.ts <tenantId>

# Listar flows
curl -X GET "https://graph.facebook.com/v21.0/{WABA_ID}/flows?fields=id,name,status" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"

# Obter detalhes do flow
curl -X GET "https://graph.facebook.com/v21.0/{FLOW_ID}?fields=id,name,status,validation_errors" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

## Troubleshooting

### Erro: "Flow not found"
- Verifique se o flowId está correto
- Confirme que o flow pertence ao WABA ID do tenant

### Erro: "Flow not published"
- Execute `publishFlow()` antes de enviar
- Verifique se há erros de validação

### Erro: "Invalid flow token"
- Use tokens únicos para cada sessão
- Não reutilize tokens de sessões anteriores

### Flow não aparece no WhatsApp
- Aguarde alguns minutos após publicar
- Verifique se o número do destinatário está correto
- Confirme que o whatsappPhoneNumberId está configurado

## Referências

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Flow JSON Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [Flow Components](https://developers.facebook.com/docs/whatsapp/flows/reference/components)
