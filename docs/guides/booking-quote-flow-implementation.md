# Implementação do Booking Quote Flow

Guia completo de implementação do formulário de orçamento de reserva via WhatsApp Flows.

## Arquivos Criados

### 1. Flow JSON Schema
- **Arquivo**: `deploy-backend/src/config/flows/booking-quote-flow.json`
- **Versão**: 5.0 (WhatsApp Flows)
- **Data API**: 3.0
- **Descrição**: Definição JSON do formulário de orçamento

### 2. TypeScript Export
- **Arquivo**: `deploy-backend/src/config/flows/booking-quote-flow.ts`
- **Exports**:
  - `bookingQuoteFlow`: Objeto do flow
  - `BookingQuoteFlowResponse`: Interface TypeScript
  - `validateBookingQuoteResponse()`: Validação de resposta
  - `parseBookingQuoteResponse()`: Parser com conversão de tipos

### 3. Scripts de Setup
- **Setup**: `deploy-backend/scripts/setup-booking-quote-flow.ts`
- **Teste**: `deploy-backend/scripts/test-booking-quote-flow.ts`

### 4. Documentação
- **README**: `deploy-backend/src/config/flows/README.md`
- **Migration**: `docs/migrations/add-booking-quote-flow-id.md`

## Estrutura do Formulário

### Tela 1: Datas (DATES_SCREEN)

```
┌─────────────────────────────────┐
│     Datas da Reserva            │
├─────────────────────────────────┤
│ Selecione as datas de check-in │
│ e check-out para sua estadia.   │
│                                 │
│ 📅 Data de Check-in             │
│   [DatePicker - min: amanhã]    │
│                                 │
│ 📅 Data de Check-out            │
│   [DatePicker - min: CI + 1]    │
│                                 │
│         [ Próximo → ]           │
└─────────────────────────────────┘
```

### Tela 2: Hóspedes (GUESTS_SCREEN)

```
┌─────────────────────────────────┐
│     Quantos Hóspedes?           │
├─────────────────────────────────┤
│ Informe o número de hóspedes   │
│ e se há crianças.               │
│                                 │
│ 👥 Quantidade de hóspedes       │
│   [Dropdown: 1-10]              │
│                                 │
│ 👶 Tem crianças?                │
│   ⚪ Sim  ⚪ Não                 │
│                                 │
│ [Se Sim for selecionado:]       │
│ 🎂 Idade da criança 1           │
│   [Dropdown: 0-17 anos]         │
│                                 │
│ 🎂 Idade da criança 2 (opc)     │
│   [Dropdown: 0-17 anos]         │
│                                 │
│ 🎂 Idade da criança 3 (opc)     │
│   [Dropdown: 0-17 anos]         │
│                                 │
│  [ ← Voltar ]  [ Continuar → ]  │
└─────────────────────────────────┘
```

### Tela 3: Confirmação (CONFIRMATION_SCREEN)

```
┌─────────────────────────────────┐
│   Resumo da Solicitação         │
├─────────────────────────────────┤
│ Confira os dados da sua         │
│ solicitação de orçamento:       │
│                                 │
│ Check-in: 15/02/2026            │
│ Check-out: 18/02/2026           │
│ Hóspedes: 2                     │
│ Crianças: Sim                   │
│                                 │
│ Ao confirmar, você receberá as  │
│ opções de quartos disponíveis.  │
│                                 │
│  [ ← Voltar ]  [ ✓ Confirmar ]  │
└─────────────────────────────────┘
```

## Fluxo de Implementação

### Passo 1: Migration (Database)

```bash
# 1. Adicionar campo ao schema.prisma
cd deploy-backend

# Adicionar ao modelo Tenant:
#   bookingQuoteFlowId String?

# 2. Criar migration
npx prisma migrate dev --name add_booking_quote_flow_id

# 3. Verificar
npx prisma studio
```

**SQL Manual (se necessário):**
```sql
ALTER TABLE "tenants"
ADD COLUMN "bookingQuoteFlowId" TEXT;
```

### Passo 2: Setup do Flow

```bash
# Criar e publicar o flow
cd deploy-backend
pnpm tsx scripts/setup-booking-quote-flow.ts <tenantId>

# Exemplo:
pnpm tsx scripts/setup-booking-quote-flow.ts abc-123-def-456
```

**Output esperado:**
```
=== WhatsApp Flow Setup: Booking Quote ===

[1/4] Validating tenant...
✓ Tenant validated: Hotel ABC (hotel-abc)

[2/4] Creating flow...
✓ Flow created with ID: 1234567890

[3/4] Publishing flow...
✓ Flow published successfully!

[4/4] Saving flow ID to tenant...
✓ Flow ID saved to tenant

=== Setup Complete ===

Flow Details:
  ID: 1234567890
  Name: Orçamento de Reserva
  Status: PUBLISHED
  Categories: APPOINTMENT_BOOKING
  JSON Version: 5.0
  Data API Version: 3.0
```

### Passo 3: Testar Envio

```bash
# Enviar flow para um número de teste
pnpm tsx scripts/test-booking-quote-flow.ts <tenantId> <phoneNumber>

# Exemplo:
pnpm tsx scripts/test-booking-quote-flow.ts abc-123 5511999999999
```

### Passo 4: Implementar Processamento de Resposta

Adicionar ao webhook handler (`process-incoming-message.worker.ts`):

```typescript
import { parseBookingQuoteResponse } from '@/config/flows/booking-quote-flow';

// No processamento de mensagens interativas
if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
  const responseJson = message.interactive.nfm_reply.response_json;

  try {
    // Parse e validação automática
    const data = parseBookingQuoteResponse(responseJson);

    logger.info(
      {
        contactId: contact.id,
        checkIn: data.checkInDate,
        checkOut: data.checkOutDate,
        numGuests: data.numGuests,
        hasChildren: data.hasChildren,
        childrenAges: data.childrenAges,
      },
      'Booking quote request received'
    );

    // Processar solicitação de orçamento
    await processBookingQuoteRequest(tenantId, contact.id, data);

    // Enviar confirmação
    await whatsAppServiceV2.sendTextMessage(
      tenantId,
      contact.phoneNumber,
      `Obrigado! Recebemos sua solicitação para ${data.checkInDate.toLocaleDateString('pt-BR')} a ${data.checkOutDate.toLocaleDateString('pt-BR')}. Em breve enviaremos as opções disponíveis.`
    );
  } catch (error) {
    logger.error({ error, responseJson }, 'Failed to parse booking quote response');

    // Notificar erro ao usuário
    await whatsAppServiceV2.sendTextMessage(
      tenantId,
      contact.phoneNumber,
      'Desculpe, houve um erro ao processar sua solicitação. Por favor, tente novamente.'
    );
  }
}
```

### Passo 5: Implementar Busca de Disponibilidade

Criar serviço para processar solicitações:

```typescript
// services/booking-quote-request.service.ts

interface ProcessedQuoteRequest {
  id: string;
  checkInDate: Date;
  checkOutDate: Date;
  nights: number;
  numGuests: number;
  hasChildren: boolean;
  childrenAges: number[];
  availableRooms: RoomOption[];
}

interface RoomOption {
  roomType: string;
  price: number;
  maxGuests: number;
  available: boolean;
}

async function processBookingQuoteRequest(
  tenantId: string,
  contactId: string,
  data: ReturnType<typeof parseBookingQuoteResponse>
): Promise<ProcessedQuoteRequest> {
  // Calcular noites
  const nights = Math.ceil(
    (data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Salvar no banco
  const quoteRequest = await prisma.bookingQuoteRequest.create({
    data: {
      tenantId,
      contactId,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      nights,
      numGuests: data.numGuests,
      hasChildren: data.hasChildren,
      childrenAges: data.childrenAges,
      status: 'PENDING',
      source: 'WHATSAPP_FLOW',
    },
  });

  // Buscar disponibilidade (integração externa)
  const availableRooms = await searchRoomAvailability(
    tenantId,
    data.checkInDate,
    data.checkOutDate,
    data.numGuests
  );

  // Enviar opções ao cliente
  await sendRoomOptions(tenantId, contactId, quoteRequest.id, availableRooms);

  return {
    id: quoteRequest.id,
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    nights,
    numGuests: data.numGuests,
    hasChildren: data.hasChildren,
    childrenAges: data.childrenAges,
    availableRooms,
  };
}
```

## Formato da Resposta

### JSON Bruto (do WhatsApp)

```json
{
  "check_in_date": "2026-02-15",
  "check_out_date": "2026-02-18",
  "num_guests": "2",
  "has_children": "yes",
  "child_age_1": "5",
  "child_age_2": "12",
  "child_age_3": ""
}
```

### Após `parseBookingQuoteResponse()`

```typescript
{
  checkInDate: Date(2026-02-15T00:00:00.000Z),
  checkOutDate: Date(2026-02-18T00:00:00.000Z),
  numGuests: 2,
  hasChildren: true,
  childrenAges: [5, 12]
}
```

## Integração com N8N

### Webhook N8N para processar solicitações

```javascript
// N8N Workflow: Process Booking Quote Request

// 1. Receber webhook do backend
// POST https://n8n.example.com/webhook/booking-quote
// Body: { tenantId, contactId, checkInDate, checkOutDate, numGuests, childrenAges }

// 2. Buscar disponibilidade no sistema de reservas
// GET https://booking-system.com/api/availability
// Query: checkIn, checkOut, guests

// 3. Formatar resposta
const rooms = $json.rooms.map(room => ({
  title: room.name,
  description: `R$ ${room.price}/noite - Até ${room.maxGuests} pessoas`,
  id: room.id
}));

// 4. Enviar lista interativa via WhatsApp
// POST https://api.crm.com/api/whatsapp/send-interactive-list
return {
  tenantId: $json.tenantId,
  phoneNumber: $json.phoneNumber,
  bodyText: 'Opções disponíveis para sua reserva:',
  buttonText: 'Ver quartos',
  sections: [{
    title: 'Quartos Disponíveis',
    rows: rooms
  }]
};
```

## Monitoramento

### Logs Importantes

```typescript
// Quando flow é enviado
logger.info({
  tenantId,
  contactId,
  flowId,
  flowToken,
  phoneNumber
}, 'Booking quote flow sent');

// Quando resposta é recebida
logger.info({
  tenantId,
  contactId,
  flowToken,
  checkInDate,
  checkOutDate,
  numGuests,
  hasChildren,
  childrenAges
}, 'Booking quote response received');

// Quando solicitação é processada
logger.info({
  tenantId,
  contactId,
  quoteRequestId,
  availableRoomsCount,
  totalPrice
}, 'Booking quote processed');
```

### Métricas para Dashboard

- Taxa de conclusão do flow (sent vs completed)
- Tempo médio de preenchimento
- Taxa de conversão (quote → booking)
- Horários de pico de solicitações
- Tipos de quartos mais solicitados

## Troubleshooting

### Flow não aparece no WhatsApp

1. Verificar se flow está PUBLISHED:
```bash
pnpm tsx -e "
import { whatsAppFlowsService } from './src/services/whatsapp-flows.service';
whatsAppFlowsService.getFlowDetails('TENANT_ID', 'FLOW_ID').then(d => console.log(d.status));
"
```

2. Verificar se flowId está salvo no tenant
3. Aguardar 5-10 minutos após publicar

### DatePicker não valida data mínima

- WhatsApp Flows v5.0 suporta validação dinâmica limitada
- Considerar validação adicional no backend ao receber resposta

### Campos de crianças não aparecem

- Verificar sintaxe do `visible`: `"${form.has_children == 'yes'}"`
- Versão do WhatsApp Flows deve ser 3.0+

## Próximos Passos

1. **Adicionar mais flows**:
   - Guest Registration (dados completos do hóspede)
   - Feedback após check-out
   - Solicitação de serviços extras

2. **Melhorar validações**:
   - Backend validar datas (check-out > check-in)
   - Verificar disponibilidade antes de processar

3. **Analytics**:
   - Dashboard com métricas de flows
   - A/B testing de textos e CTAs

4. **Automação**:
   - Auto-envio de flow após primeira interação
   - Lembretes se flow não for completado

## Referências

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Flow JSON v5.0 Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [DatePicker Component](https://developers.facebook.com/docs/whatsapp/flows/reference/components#datepicker)
- [Dropdown Component](https://developers.facebook.com/docs/whatsapp/flows/reference/components#dropdown)
- [Service Implementation](../../deploy-backend/src/services/whatsapp-flows.service.ts)
