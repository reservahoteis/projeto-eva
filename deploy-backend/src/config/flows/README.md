# WhatsApp Flows - Formulários de Reserva

Este diretório contém os JSON Schemas para WhatsApp Flows utilizados no sistema de reservas.

## Flows Disponíveis

### 1. Booking Quote Flow (`booking-quote-flow.json`)

Formulário de solicitação de orçamento de reserva com 3 telas:

**Tela 1: Datas (DATES_SCREEN)**
- Check-in: DatePicker (mínimo = amanhã)
- Check-out: DatePicker (mínimo = check-in + 1)

**Tela 2: Hóspedes (GUESTS_SCREEN)**
- Quantidade de hóspedes: Dropdown (1-10)
- Tem crianças?: RadioButtons (Sim/Não)
- Idade das crianças: Dropdown condicional (0-17 anos)
  - Até 3 crianças podem ser cadastradas
  - Campos aparecem apenas se "Sim" for selecionado

**Tela 3: Confirmação (CONFIRMATION_SCREEN)**
- Resumo dos dados informados
- Botão para voltar ou confirmar

## Como Usar

### 1. Criar e Publicar o Flow

```typescript
import { bookingQuoteFlow } from '@/config/flows/booking-quote-flow';
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';

async function setupBookingQuoteFlow(tenantId: string) {
  // Criar flow
  const { flowId } = await whatsAppFlowsService.createFlow(
    tenantId,
    bookingQuoteFlow,
    'Orçamento de Reserva',
    ['APPOINTMENT_BOOKING']
  );

  console.log('Flow criado:', flowId);

  // Publicar flow
  await whatsAppFlowsService.publishFlow(tenantId, flowId);

  console.log('Flow publicado com sucesso!');

  return flowId;
}
```

### 2. Enviar Flow para o Cliente

```typescript
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';

async function sendBookingQuoteFlow(
  tenantId: string,
  phoneNumber: string,
  flowId: string
) {
  // Token único para rastrear a sessão
  const flowToken = `booking_${tenantId.slice(0, 8)}_${Date.now()}`;

  await whatsAppFlowsService.sendFlow(
    tenantId,
    phoneNumber,
    flowId,
    flowToken,
    'Solicitar Orçamento', // Texto do botão
    {
      headerText: 'Faça sua Reserva',
      bodyText: 'Preencha as informações para receber as opções disponíveis e valores.',
      footerText: 'Processo rápido e seguro'
    }
  );

  console.log(`Flow enviado para ${phoneNumber}`);
  return flowToken;
}
```

### 3. Processar Resposta do Webhook

```typescript
import { parseBookingQuoteResponse, validateBookingQuoteResponse } from '@/config/flows/booking-quote-flow';

// No webhook handler (process-incoming-message.worker.ts)
if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
  const responseJson = message.interactive.nfm_reply.response_json;

  // Opção 1: Validação manual
  const data = JSON.parse(responseJson);
  if (validateBookingQuoteResponse(data)) {
    console.log('Check-in:', data.check_in_date);
    console.log('Check-out:', data.check_out_date);
    console.log('Hóspedes:', data.num_guests);
    console.log('Tem crianças:', data.has_children);
  }

  // Opção 2: Parser com conversão automática
  const parsed = parseBookingQuoteResponse(responseJson);
  console.log({
    checkIn: parsed.checkInDate, // Date object
    checkOut: parsed.checkOutDate, // Date object
    numGuests: parsed.numGuests, // number
    hasChildren: parsed.hasChildren, // boolean
    childrenAges: parsed.childrenAges // number[] (ex: [0, 5, 12])
  });

  // Processar solicitação de orçamento
  await processBookingQuoteRequest(tenantId, contactId, parsed);
}
```

### 4. Integração Completa (Exemplo)

```typescript
import { bookingQuoteFlow, parseBookingQuoteResponse } from '@/config/flows/booking-quote-flow';
import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';
import { prisma } from '@/config/database';
import logger from '@/config/logger';

/**
 * Fluxo completo: Setup -> Envio -> Processamento
 */
export class BookingQuoteFlowService {
  /**
   * Setup inicial do flow (executar 1x por tenant)
   */
  async setup(tenantId: string): Promise<string> {
    const { flowId } = await whatsAppFlowsService.createFlow(
      tenantId,
      bookingQuoteFlow,
      'Orçamento de Reserva',
      ['APPOINTMENT_BOOKING']
    );

    await whatsAppFlowsService.publishFlow(tenantId, flowId);

    // Salvar flowId no tenant para reutilizar
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { bookingQuoteFlowId: flowId }
    });

    logger.info({ tenantId, flowId }, 'Booking quote flow setup complete');

    return flowId;
  }

  /**
   * Enviar flow para um contato
   */
  async sendToContact(
    tenantId: string,
    contactId: string
  ): Promise<string> {
    // Obter flowId do tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { bookingQuoteFlowId: true }
    });

    if (!tenant?.bookingQuoteFlowId) {
      throw new Error('Booking quote flow not configured for tenant');
    }

    // Obter dados do contato
    const contact = await prisma.contact.findUnique({
      where: { id: contactId, tenantId },
      select: { phoneNumber: true, name: true }
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Token único
    const flowToken = `booking_${contactId}_${Date.now()}`;

    // Enviar flow
    await whatsAppFlowsService.sendFlow(
      tenantId,
      contact.phoneNumber,
      tenant.bookingQuoteFlowId,
      flowToken,
      'Solicitar Orçamento',
      {
        headerText: 'Olá!',
        bodyText: `${contact.name || 'Cliente'}, preencha as informações abaixo para receber opções de quartos e valores.`,
        footerText: 'Processo rápido - leva menos de 1 minuto'
      }
    );

    // Registrar envio
    await prisma.flowSession.create({
      data: {
        tenantId,
        contactId,
        flowId: tenant.bookingQuoteFlowId,
        flowToken,
        flowType: 'BOOKING_QUOTE',
        status: 'SENT',
        sentAt: new Date()
      }
    });

    logger.info({ tenantId, contactId, flowToken }, 'Booking quote flow sent');

    return flowToken;
  }

  /**
   * Processar resposta do flow
   */
  async processResponse(
    tenantId: string,
    contactId: string,
    responseJson: string
  ): Promise<void> {
    // Parse da resposta
    const data = parseBookingQuoteResponse(responseJson);

    logger.info(
      { tenantId, contactId, data },
      'Booking quote flow response received'
    );

    // Calcular número de noites
    const nights = Math.ceil(
      (data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Registrar solicitação de orçamento
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
        source: 'WHATSAPP_FLOW'
      }
    });

    // Atualizar sessão do flow
    await prisma.flowSession.updateMany({
      where: {
        tenantId,
        contactId,
        flowType: 'BOOKING_QUOTE',
        status: 'SENT'
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        responseData: data
      }
    });

    // Buscar opções disponíveis (integração com sistema de reservas)
    const availableRooms = await this.searchAvailableRooms(
      tenantId,
      data.checkInDate,
      data.checkOutDate,
      data.numGuests
    );

    // Enviar resposta com opções
    await this.sendQuoteResponse(
      tenantId,
      contactId,
      quoteRequest.id,
      availableRooms
    );
  }

  private async searchAvailableRooms(
    tenantId: string,
    checkIn: Date,
    checkOut: Date,
    numGuests: number
  ) {
    // TODO: Implementar integração com sistema de reservas
    // Por enquanto, retornar mock
    return [
      {
        roomType: 'Standard',
        price: 150.00,
        maxGuests: 2
      },
      {
        roomType: 'Deluxe',
        price: 250.00,
        maxGuests: 4
      }
    ];
  }

  private async sendQuoteResponse(
    tenantId: string,
    contactId: string,
    quoteRequestId: string,
    rooms: any[]
  ) {
    // TODO: Implementar envio de mensagem com opções
    // Pode usar mensagens interativas (lista ou botões)
    logger.info(
      { tenantId, contactId, quoteRequestId, rooms },
      'Sending quote response'
    );
  }
}

export const bookingQuoteFlowService = new BookingQuoteFlowService();
```

## Estrutura da Resposta

Quando o cliente completa o flow, o webhook recebe:

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

Após processar com `parseBookingQuoteResponse`:

```typescript
{
  checkInDate: Date(2026-02-15),
  checkOutDate: Date(2026-02-18),
  numGuests: 2,
  hasChildren: true,
  childrenAges: [5, 12]
}
```

## Comandos Úteis

```bash
# Setup do flow para um tenant
pnpm tsx -e "
import { bookingQuoteFlowService } from './src/services/booking-quote-flow.service';
bookingQuoteFlowService.setup('TENANT_ID').then(console.log);
"

# Enviar flow para um contato
pnpm tsx -e "
import { bookingQuoteFlowService } from './src/services/booking-quote-flow.service';
bookingQuoteFlowService.sendToContact('TENANT_ID', 'CONTACT_ID').then(console.log);
"
```

## Limitações do WhatsApp Flows

- Máximo 10 telas por flow
- Máximo 50 componentes por tela
- DatePicker: datas dinâmicas devem usar variáveis do form
- Dropdown: máximo 100 opções
- Campos condicionais (visible): suportado apenas em versões recentes

## Próximos Passos

1. Criar schema no Prisma para `flowSession` e `bookingQuoteRequest`
2. Implementar integração com sistema de disponibilidade de quartos
3. Criar mensagem de resposta com opções de quartos (lista interativa)
4. Adicionar analytics de conversão de flows
5. Implementar testes automatizados

## Referências

- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Flow JSON Reference](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
- [DatePicker Component](https://developers.facebook.com/docs/whatsapp/flows/reference/components#datepicker)
- [Dropdown Component](https://developers.facebook.com/docs/whatsapp/flows/reference/components#dropdown)
- [RadioButtonsGroup Component](https://developers.facebook.com/docs/whatsapp/flows/reference/components#radiobuttonsgroup)
