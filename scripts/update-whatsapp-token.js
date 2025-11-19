/**
 * Script para atualizar o Access Token do WhatsApp Business API
 *
 * USO:
 * node scripts/update-whatsapp-token.js "SEU_NOVO_TOKEN_AQUI" "hoteis-reserva"
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateWhatsAppToken(token, tenantSlug) {
    try {
        // Validar entrada
        if (!token || !tenantSlug) {
            console.error('Erro: Token e slug do tenant são obrigatórios');
            console.log('Uso: node update-whatsapp-token.js "TOKEN" "TENANT_SLUG"');
            process.exit(1);
        }

        // Verificar se tenant existe
        const tenantExists = await prisma.tenant.findUnique({
            where: { slug: tenantSlug }
        });

        if (!tenantExists) {
            console.error(`Erro: Tenant '${tenantSlug}' não encontrado`);
            process.exit(1);
        }

        console.log(`\n=== Atualizando Token WhatsApp ===`);
        console.log(`Tenant: ${tenantSlug}`);
        console.log(`Token (preview): ${token.substring(0, 20)}...`);
        console.log(`Tamanho do token: ${token.length} caracteres`);

        // Atualizar token
        const updatedTenant = await prisma.tenant.update({
            where: { slug: tenantSlug },
            data: {
                whatsappAccessToken: token,
                updatedAt: new Date()
            }
        });

        console.log(`\n✓ Token atualizado com sucesso!`);
        console.log(`Última atualização: ${updatedTenant.updatedAt}`);

        // Verificar configuração completa
        const config = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: {
                slug: true,
                name: true,
                whatsappPhoneNumberId: true,
                whatsappBusinessAccountId: true,
                whatsappAccessToken: true,
                updatedAt: true
            }
        });

        console.log(`\n=== Status da Integração WhatsApp ===`);
        console.log(`Nome: ${config.name}`);
        console.log(`Phone Number ID: ${config.whatsappPhoneNumberId || 'Não configurado'}`);
        console.log(`Business Account ID: ${config.whatsappBusinessAccountId || 'Não configurado'}`);
        console.log(`Token configurado: ${config.whatsappAccessToken ? 'Sim' : 'Não'}`);

        // Avisos importantes
        console.log(`\n⚠️  AVISOS IMPORTANTES:`);
        console.log(`1. Se este é um token temporário, ele expira em 24 horas`);
        console.log(`2. Para produção, gere um token permanente no Meta Business Suite`);
        console.log(`3. Teste o envio de mensagens para confirmar que está funcionando`);

        // Sugerir teste
        console.log(`\n=== Teste Rápido ===`);
        console.log(`Execute este comando para testar o token:`);
        console.log(`curl -X GET "https://graph.facebook.com/v18.0/${config.whatsappPhoneNumberId || 'YOUR_PHONE_NUMBER_ID'}/messages" -H "Authorization: Bearer ${token.substring(0, 20)}..."`);

    } catch (error) {
        console.error('Erro ao atualizar token:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Executar script
const [,, token, tenantSlug = 'hoteis-reserva'] = process.argv;
updateWhatsAppToken(token, tenantSlug);