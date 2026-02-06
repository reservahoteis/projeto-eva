/**
 * WhatsApp Flow: Formulário de Orçamento de Reserva
 *
 * Este flow coleta as seguintes informações:
 * 1. Datas de check-in e check-out
 * 2. Quantidade de hóspedes (1-10)
 * 3. Se há crianças
 * 4. Idade das crianças (0-17 anos)
 *
 * Fluxo de navegação:
 * DATES_SCREEN -> GUESTS_SCREEN -> CONFIRMATION_SCREEN
 *
 * Uso:
 * ```typescript
 * import { bookingQuoteFlow } from '@/config/flows/booking-quote-flow';
 * import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';
 *
 * const { flowId } = await whatsAppFlowsService.createFlow(
 *   tenantId,
 *   bookingQuoteFlow,
 *   'Orçamento de Reserva',
 *   ['APPOINTMENT_BOOKING']
 * );
 * ```
 */

export interface BookingQuoteFlowResponse {
  check_in_date: string; // ISO 8601 date (YYYY-MM-DD)
  check_out_date: string; // ISO 8601 date (YYYY-MM-DD)
  num_guests: string; // "1" to "10"
  has_children: 'yes' | 'no';
  child_age_1?: string; // "0" to "17" (opcional)
  child_age_2?: string; // "0" to "17" (opcional)
  child_age_3?: string; // "0" to "17" (opcional)
}

export const bookingQuoteFlow = {
  version: '5.0',
  data_api_version: '3.0',
  routing_model: {
    DATES_SCREEN: ['GUESTS_SCREEN'],
    GUESTS_SCREEN: ['CONFIRMATION_SCREEN'],
  },
  screens: [
    {
      id: 'DATES_SCREEN',
      title: 'Selecione as datas',
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Datas da Reserva',
          },
          {
            type: 'TextBody',
            text: 'Selecione as datas de check-in e check-out para sua estadia.',
          },
          {
            type: 'DatePicker',
            name: 'check_in_date',
            label: 'Data de Check-in',
            required: true,
            'min-date': '${form.tomorrow}',
            'helper-text': 'Data mínima: amanhã',
          },
          {
            type: 'DatePicker',
            name: 'check_out_date',
            label: 'Data de Check-out',
            required: true,
            'min-date': '${form.check_in_date_plus_one}',
            'helper-text': 'Data mínima: 1 dia após check-in',
          },
          {
            type: 'Footer',
            label: 'Próximo',
            'on-click-action': {
              name: 'navigate',
              next: {
                type: 'screen',
                name: 'GUESTS_SCREEN',
              },
              payload: {},
            },
          },
        ],
      },
    },
    {
      id: 'GUESTS_SCREEN',
      title: 'Informações dos Hóspedes',
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Quantos Hóspedes?',
          },
          {
            type: 'TextBody',
            text: 'Informe o número de hóspedes e se há crianças.',
          },
          {
            type: 'Dropdown',
            name: 'num_guests',
            label: 'Quantidade de hóspedes',
            required: true,
            'data-source': [
              { id: '1', title: '1 hóspede' },
              { id: '2', title: '2 hóspedes' },
              { id: '3', title: '3 hóspedes' },
              { id: '4', title: '4 hóspedes' },
              { id: '5', title: '5 hóspedes' },
              { id: '6', title: '6 hóspedes' },
              { id: '7', title: '7 hóspedes' },
              { id: '8', title: '8 hóspedes' },
              { id: '9', title: '9 hóspedes' },
              { id: '10', title: '10 hóspedes' },
            ],
          },
          {
            type: 'RadioButtonsGroup',
            name: 'has_children',
            label: 'Tem crianças?',
            required: true,
            'data-source': [
              { id: 'yes', title: 'Sim' },
              { id: 'no', title: 'Não' },
            ],
          },
          {
            type: 'Dropdown',
            name: 'child_age_1',
            label: 'Idade da criança 1',
            required: false,
            visible: "${form.has_children == 'yes'}",
            'data-source': [
              { id: '0', title: '0 anos' },
              { id: '1', title: '1 ano' },
              { id: '2', title: '2 anos' },
              { id: '3', title: '3 anos' },
              { id: '4', title: '4 anos' },
              { id: '5', title: '5 anos' },
              { id: '6', title: '6 anos' },
              { id: '7', title: '7 anos' },
              { id: '8', title: '8 anos' },
              { id: '9', title: '9 anos' },
              { id: '10', title: '10 anos' },
              { id: '11', title: '11 anos' },
              { id: '12', title: '12 anos' },
              { id: '13', title: '13 anos' },
              { id: '14', title: '14 anos' },
              { id: '15', title: '15 anos' },
              { id: '16', title: '16 anos' },
              { id: '17', title: '17 anos' },
            ],
          },
          {
            type: 'Dropdown',
            name: 'child_age_2',
            label: 'Idade da criança 2 (opcional)',
            required: false,
            visible: "${form.has_children == 'yes'}",
            'data-source': [
              { id: '0', title: '0 anos' },
              { id: '1', title: '1 ano' },
              { id: '2', title: '2 anos' },
              { id: '3', title: '3 anos' },
              { id: '4', title: '4 anos' },
              { id: '5', title: '5 anos' },
              { id: '6', title: '6 anos' },
              { id: '7', title: '7 anos' },
              { id: '8', title: '8 anos' },
              { id: '9', title: '9 anos' },
              { id: '10', title: '10 anos' },
              { id: '11', title: '11 anos' },
              { id: '12', title: '12 anos' },
              { id: '13', title: '13 anos' },
              { id: '14', title: '14 anos' },
              { id: '15', title: '15 anos' },
              { id: '16', title: '16 anos' },
              { id: '17', title: '17 anos' },
            ],
          },
          {
            type: 'Dropdown',
            name: 'child_age_3',
            label: 'Idade da criança 3 (opcional)',
            required: false,
            visible: "${form.has_children == 'yes'}",
            'data-source': [
              { id: '0', title: '0 anos' },
              { id: '1', title: '1 ano' },
              { id: '2', title: '2 anos' },
              { id: '3', title: '3 anos' },
              { id: '4', title: '4 anos' },
              { id: '5', title: '5 anos' },
              { id: '6', title: '6 anos' },
              { id: '7', title: '7 anos' },
              { id: '8', title: '8 anos' },
              { id: '9', title: '9 anos' },
              { id: '10', title: '10 anos' },
              { id: '11', title: '11 anos' },
              { id: '12', title: '12 anos' },
              { id: '13', title: '13 anos' },
              { id: '14', title: '14 anos' },
              { id: '15', title: '15 anos' },
              { id: '16', title: '16 anos' },
              { id: '17', title: '17 anos' },
            ],
          },
          {
            type: 'Footer',
            label: 'Voltar',
            'on-click-action': {
              name: 'navigate',
              next: {
                type: 'screen',
                name: 'DATES_SCREEN',
              },
              payload: {},
            },
          },
          {
            type: 'Footer',
            label: 'Continuar',
            'on-click-action': {
              name: 'navigate',
              next: {
                type: 'screen',
                name: 'CONFIRMATION_SCREEN',
              },
              payload: {},
            },
          },
        ],
      },
    },
    {
      id: 'CONFIRMATION_SCREEN',
      title: 'Confirmar Solicitação',
      data: {},
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'TextHeading',
            text: 'Resumo da Solicitação',
          },
          {
            type: 'TextBody',
            text: 'Confira os dados da sua solicitação de orçamento:',
          },
          {
            type: 'TextCaption',
            text: 'Check-in: ${form.check_in_date}',
          },
          {
            type: 'TextCaption',
            text: 'Check-out: ${form.check_out_date}',
          },
          {
            type: 'TextCaption',
            text: 'Hóspedes: ${form.num_guests}',
          },
          {
            type: 'TextCaption',
            text: "Crianças: ${form.has_children == 'yes' ? 'Sim' : 'Não'}",
          },
          {
            type: 'TextBody',
            text: 'Ao confirmar, você receberá as opções de quartos disponíveis com os valores.',
          },
          {
            type: 'Footer',
            label: 'Voltar',
            'on-click-action': {
              name: 'navigate',
              next: {
                type: 'screen',
                name: 'GUESTS_SCREEN',
              },
              payload: {},
            },
          },
          {
            type: 'Footer',
            label: 'Confirmar',
            'on-click-action': {
              name: 'complete',
              payload: {
                check_in_date: '${form.check_in_date}',
                check_out_date: '${form.check_out_date}',
                num_guests: '${form.num_guests}',
                has_children: '${form.has_children}',
                child_age_1: '${form.child_age_1}',
                child_age_2: '${form.child_age_2}',
                child_age_3: '${form.child_age_3}',
              },
            },
          },
        ],
      },
    },
  ],
} as const;

/**
 * Helper para validar resposta do flow
 *
 * @example
 * ```typescript
 * import { validateBookingQuoteResponse } from '@/config/flows/booking-quote-flow';
 *
 * const responseJson = message.interactive.nfm_reply.response_json;
 * const data = JSON.parse(responseJson);
 *
 * if (validateBookingQuoteResponse(data)) {
 *   console.log('Check-in:', data.check_in_date);
 *   console.log('Check-out:', data.check_out_date);
 *   console.log('Hóspedes:', data.num_guests);
 *   // ... processar dados
 * }
 * ```
 */
export function validateBookingQuoteResponse(data: any): data is BookingQuoteFlowResponse {
  return (
    typeof data === 'object' &&
    typeof data.check_in_date === 'string' &&
    typeof data.check_out_date === 'string' &&
    typeof data.num_guests === 'string' &&
    (data.has_children === 'yes' || data.has_children === 'no')
  );
}

/**
 * Helper para processar resposta do flow
 *
 * @example
 * ```typescript
 * import { parseBookingQuoteResponse } from '@/config/flows/booking-quote-flow';
 *
 * const responseJson = message.interactive.nfm_reply.response_json;
 * const parsed = parseBookingQuoteResponse(responseJson);
 *
 * console.log({
 *   checkIn: parsed.checkInDate,
 *   checkOut: parsed.checkOutDate,
 *   numGuests: parsed.numGuests,
 *   hasChildren: parsed.hasChildren,
 *   childrenAges: parsed.childrenAges // [0, 5, 12] ou []
 * });
 * ```
 */
export function parseBookingQuoteResponse(responseJson: string) {
  const data = JSON.parse(responseJson) as BookingQuoteFlowResponse;

  if (!validateBookingQuoteResponse(data)) {
    throw new Error('Invalid booking quote response format');
  }

  const childrenAges: number[] = [];

  if (data.has_children === 'yes') {
    if (data.child_age_1) childrenAges.push(parseInt(data.child_age_1, 10));
    if (data.child_age_2) childrenAges.push(parseInt(data.child_age_2, 10));
    if (data.child_age_3) childrenAges.push(parseInt(data.child_age_3, 10));
  }

  return {
    checkInDate: new Date(data.check_in_date),
    checkOutDate: new Date(data.check_out_date),
    numGuests: parseInt(data.num_guests, 10),
    hasChildren: data.has_children === 'yes',
    childrenAges,
  };
}
