#!/usr/bin/env tsx

/**
 * Script para criar e publicar o WhatsApp Flow de orçamento de reserva
 *
 * Uso:
 * pnpm tsx scripts/setup-booking-quote-flow.ts <tenantId>
 *
 * Exemplo:
 * pnpm tsx scripts/setup-booking-quote-flow.ts abc-123-def-456
 */

import { whatsAppFlowsService } from '../src/services/whatsapp-flows.service';
import { bookingQuoteFlow } from '../src/config/flows/booking-quote-flow';
import { prisma } from '../src/config/database';
import logger from '../src/config/logger';

interface SetupResult {
  flowId: string;
  status: 'PUBLISHED' | 'DRAFT';
  validationErrors?: any[];
}

async function setupBookingQuoteFlow(tenantId: string): Promise<SetupResult> {
  console.log('\n=== WhatsApp Flow Setup: Booking Quote ===\n');

  // 1. Validar tenant
  console.log('[1/4] Validating tenant...');
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      slug: true,
      whatsappBusinessAccountId: true,
      whatsappAccessToken: true,
      whatsappPhoneNumberId: true,
    },
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  if (!tenant.whatsappBusinessAccountId || !tenant.whatsappAccessToken) {
    throw new Error(
      `Tenant ${tenant.name} does not have WhatsApp configured. ` +
        'Please configure whatsappBusinessAccountId and whatsappAccessToken first.'
    );
  }

  console.log(`✓ Tenant validated: ${tenant.name} (${tenant.slug})`);

  // 2. Criar flow
  console.log('\n[2/4] Creating flow...');
  const { flowId } = await whatsAppFlowsService.createFlow(
    tenantId,
    bookingQuoteFlow,
    'Orçamento de Reserva',
    ['APPOINTMENT_BOOKING']
  );

  console.log(`✓ Flow created with ID: ${flowId}`);

  // 3. Publicar flow
  console.log('\n[3/4] Publishing flow...');
  const publishResult = await whatsAppFlowsService.publishFlow(tenantId, flowId);

  if (publishResult.validationErrors && publishResult.validationErrors.length > 0) {
    console.warn('\n⚠ Flow published with validation warnings:');
    console.warn(JSON.stringify(publishResult.validationErrors, null, 2));
  } else {
    console.log('✓ Flow published successfully!');
  }

  // 4. Salvar flowId no tenant
  console.log('\n[4/4] Saving flow ID to tenant...');
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { bookingQuoteFlowId: flowId },
  });

  console.log('✓ Flow ID saved to tenant');

  // Obter detalhes do flow
  const flowDetails = await whatsAppFlowsService.getFlowDetails(tenantId, flowId);

  console.log('\n=== Setup Complete ===\n');
  console.log('Flow Details:');
  console.log(`  ID: ${flowDetails.id}`);
  console.log(`  Name: ${flowDetails.name}`);
  console.log(`  Status: ${flowDetails.status}`);
  console.log(`  Categories: ${flowDetails.categories.join(', ')}`);
  console.log(`  JSON Version: ${flowDetails.json_version}`);
  console.log(`  Data API Version: ${flowDetails.data_api_version}`);

  if (flowDetails.preview) {
    console.log(`\n📱 Preview URL: ${flowDetails.preview.preview_url}`);
    console.log(`   Expires at: ${flowDetails.preview.expires_at}`);
  }

  console.log('\n✅ Ready to send to contacts!');
  console.log('\nExample usage:');
  console.log(`
    import { whatsAppFlowsService } from '@/services/whatsapp-flows.service';

    await whatsAppFlowsService.sendFlow(
      '${tenantId}',
      '5511999999999',
      '${flowId}',
      'booking_' + Date.now(),
      'Solicitar Orçamento',
      {
        headerText: 'Faça sua Reserva',
        bodyText: 'Preencha as informações para receber as opções disponíveis.',
      }
    );
  `);

  return {
    flowId: flowDetails.id,
    status: flowDetails.status as 'PUBLISHED' | 'DRAFT',
    validationErrors: flowDetails.validation_errors,
  };
}

// CLI Execution
if (require.main === module) {
  const tenantId = process.argv[2];

  if (!tenantId) {
    console.error('Error: Tenant ID is required');
    console.error('Usage: pnpm tsx scripts/setup-booking-quote-flow.ts <tenantId>');
    console.error('\nExample:');
    console.error('  pnpm tsx scripts/setup-booking-quote-flow.ts abc-123-def-456');
    process.exit(1);
  }

  setupBookingQuoteFlow(tenantId)
    .then((result) => {
      logger.info({ tenantId, flowId: result.flowId }, 'Booking quote flow setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error setting up flow:', error.message);

      if (error.response?.data) {
        console.error('\nAPI Error Details:');
        console.error(JSON.stringify(error.response.data, null, 2));
      }

      logger.error({ error, tenantId }, 'Failed to setup booking quote flow');
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export { setupBookingQuoteFlow };
