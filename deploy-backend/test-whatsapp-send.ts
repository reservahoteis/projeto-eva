/**
 * Script de teste - Enviar mensagem WhatsApp via API
 *
 * Uso:
 *   npx tsx test-whatsapp-send.ts [NUMERO_DESTINO]
 *
 * Exemplo:
 *   npx tsx test-whatsapp-send.ts 15556398497
 */

import { whatsAppServiceV2 } from './src/services/whatsapp.service.v2';
import { prisma } from './src/config/database';
import logger from './src/config/logger';

async function testSendMessage() {
  try {
    // Número de destino (argumento ou número de teste padrão da Meta)
    const to = process.argv[2] || '15556398497';

    console.log('🚀 Teste de Envio de Mensagem WhatsApp');
    console.log('=====================================\n');

    // 1. Buscar tenant hotel-ipanema
    console.log('1️⃣ Buscando tenant hotel-ipanema...');
    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'hotel-ipanema' },
      select: {
        id: true,
        name: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant hotel-ipanema não encontrado');
    }

    console.log(`✅ Tenant encontrado: ${tenant.name}`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Phone Number ID: ${tenant.whatsappPhoneNumberId ? '✓' : '✗'}`);
    console.log(`   Access Token: ${tenant.whatsappAccessToken ? '✓' : '✗'}\n`);

    if (!tenant.whatsappPhoneNumberId || !tenant.whatsappAccessToken) {
      throw new Error('Tenant não tem credenciais WhatsApp configuradas');
    }

    // 2. Enviar mensagem de teste
    console.log(`2️⃣ Enviando mensagem para ${to}...`);
    const result = await whatsAppServiceV2.sendTextMessage(
      tenant.id,
      to,
      '🎉 Olá! Esta é uma mensagem de teste do Hotel Ipanema!\n\n' +
        'Se você recebeu esta mensagem, significa que a integração WhatsApp Business API está funcionando perfeitamente! ✅\n\n' +
        'Desenvolvido com ❤️ usando Node.js + TypeScript + Meta WhatsApp Cloud API'
    );

    console.log('✅ Mensagem enviada com sucesso!');
    console.log(`   WhatsApp Message ID: ${result.whatsappMessageId}\n`);

    console.log('🎊 TESTE CONCLUÍDO COM SUCESSO! 🎊');
    console.log('Verifique o WhatsApp no número de destino para confirmar o recebimento.\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERRO ao enviar mensagem:');

    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      if ('code' in error) {
        console.error(`   Código: ${(error as any).code}`);
      }

      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
testSendMessage();
