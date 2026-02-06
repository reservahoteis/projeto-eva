#!/usr/bin/env tsx

/**
 * Script de teste para envio do WhatsApp Flow de orçamento de reserva
 *
 * Uso:
 * pnpm tsx scripts/test-booking-quote-flow.ts <tenantId> <phoneNumber>
 *
 * Exemplo:
 * pnpm tsx scripts/test-booking-quote-flow.ts abc-123-def-456 5511999999999
 */

import { whatsAppFlowsService } from '../src/services/whatsapp-flows.service';
import { prisma } from '../src/config/database';
import logger from '../src/config/logger';

interface TestResult {
  success: boolean;
  flowToken: string;
  whatsappMessageId?: string;
  error?: string;
}

async function testBookingQuoteFlow(
  tenantId: string,
  phoneNumber: string
): Promise<TestResult> {
  console.log('\n=== WhatsApp Flow Test: Booking Quote ===\n');

  try {
    // 1. Validar tenant
    console.log('[1/5] Validating tenant...');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        bookingQuoteFlowId: true,
        whatsappPhoneNumberId: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    if (!tenant.bookingQuoteFlowId) {
      throw new Error(
        `Tenant ${tenant.name} does not have booking quote flow configured. ` +
          'Run setup-booking-quote-flow.ts first.'
      );
    }

    console.log(`✓ Tenant validated: ${tenant.name}`);
    console.log(`  Flow ID: ${tenant.bookingQuoteFlowId}`);

    // 2. Validar telefone
    console.log('\n[2/5] Validating phone number...');
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    if (!/^55\d{10,11}$/.test(cleanPhone)) {
      throw new Error(
        'Invalid phone number format. Expected Brazilian format: 5511999999999'
      );
    }

    console.log(`✓ Phone validated: ${cleanPhone}`);

    // 3. Buscar ou criar contato
    console.log('\n[3/5] Finding or creating contact...');
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        phoneNumber: cleanPhone,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          phoneNumber: cleanPhone,
          name: 'Test Contact',
        },
      });
      console.log(`✓ Contact created: ${contact.id}`);
    } else {
      console.log(`✓ Contact found: ${contact.id} (${contact.name || 'Unknown'})`);
    }

    // 4. Gerar flow token
    console.log('\n[4/5] Generating flow token...');
    const flowToken = `booking_test_${tenantId.slice(0, 8)}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    console.log(`✓ Flow token: ${flowToken}`);

    // 5. Enviar flow
    console.log('\n[5/5] Sending flow to WhatsApp...');
    const result = await whatsAppFlowsService.sendFlow(
      tenantId,
      cleanPhone,
      tenant.bookingQuoteFlowId,
      flowToken,
      'Solicitar Orçamento',
      {
        headerText: 'Teste de Orçamento',
        bodyText:
          'Este é um teste do formulário de orçamento de reserva. ' +
          'Preencha as informações para testar o fluxo completo.',
        footerText: 'Teste - ambiente de desenvolvimento',
      }
    );

    console.log(`✓ Flow sent successfully!`);
    console.log(`  WhatsApp Message ID: ${result.whatsappMessageId}`);

    // 6. Registrar na tabela de sessões (se existir)
    try {
      await prisma.flowSession.create({
        data: {
          tenantId,
          contactId: contact.id,
          flowId: tenant.bookingQuoteFlowId,
          flowToken,
          flowType: 'BOOKING_QUOTE',
          status: 'SENT',
          sentAt: new Date(),
        },
      });
      console.log('\n✓ Flow session registered in database');
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log('\n⚠ Flow session already exists (duplicate flowToken)');
      } else if (error.code === 'P2021') {
        console.log('\n⚠ FlowSession table does not exist yet (run migration first)');
      } else {
        console.warn('\n⚠ Could not register flow session:', error.message);
      }
    }

    console.log('\n=== Test Complete ===\n');
    console.log('✅ Flow sent successfully!');
    console.log('\nNext steps:');
    console.log('1. Open WhatsApp on the test phone');
    console.log('2. Check for the message with the flow button');
    console.log('3. Fill out the form');
    console.log('4. Check webhook logs for the response');
    console.log(`\nFlow token to track: ${flowToken}`);

    return {
      success: true,
      flowToken,
      whatsappMessageId: result.whatsappMessageId,
    };
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);

    if (error.response?.data) {
      console.error('\nAPI Error Details:');
      console.error(JSON.stringify(error.response.data, null, 2));
    }

    return {
      success: false,
      flowToken: '',
      error: error.message,
    };
  }
}

// CLI Execution
if (require.main === module) {
  const tenantId = process.argv[2];
  const phoneNumber = process.argv[3];

  if (!tenantId || !phoneNumber) {
    console.error('Error: Tenant ID and phone number are required');
    console.error('Usage: pnpm tsx scripts/test-booking-quote-flow.ts <tenantId> <phoneNumber>');
    console.error('\nExample:');
    console.error('  pnpm tsx scripts/test-booking-quote-flow.ts abc-123 5511999999999');
    console.error('\nNote: Phone must be in Brazilian format: 55 + DDD + number');
    process.exit(1);
  }

  testBookingQuoteFlow(tenantId, phoneNumber)
    .then((result) => {
      if (result.success) {
        logger.info(
          { tenantId, phoneNumber, flowToken: result.flowToken },
          'Booking quote flow test completed'
        );
        process.exit(0);
      } else {
        logger.error(
          { tenantId, phoneNumber, error: result.error },
          'Booking quote flow test failed'
        );
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error({ error, tenantId, phoneNumber }, 'Unexpected error in test');
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { testBookingQuoteFlow };
