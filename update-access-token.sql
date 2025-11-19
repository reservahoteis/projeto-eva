-- =====================================================
-- ATUALIZAÇÃO DE ACCESS TOKEN - WHATSAPP BUSINESS API
-- =====================================================
-- Tenant: hoteis-reserva
-- Data: 2025-11-18
-- Tipo: Token Temporário (24 horas)
-- =====================================================

-- 1. ATUALIZAR TOKEN DO WHATSAPP
UPDATE tenants
SET
    "whatsappAccessToken" = 'EAAhLVq96CJ8BP8ZA1vqUyREyvxmOrI8R9owQiW2gjHsregaGRZAOEt3zGIIuJZBRDTwds0s4Q9JZC6sunwK8t8YVdAlZAIimZBvlPb0U811cCNEWUdMndf1dz64UUzKUBFA8VNXDpuJapTmMoReZCNW6aleyZBZBLT1RxgmohVtmFWiRHUipGP1x2dN76qobTLQ3zb1bVZCbLTEcdnvyvpZAQJ6FAZC37pt7ax6zyBiTGJOg9CchveWcOuUCJsumfjHpKfDSnCrOQWIiYu7tmAqBzZA2yZCfn7rZB50kZCbsnnnvoZBIZD',
    "updatedAt" = NOW()
WHERE slug = 'hoteis-reserva';

-- 2. VERIFICAR ATUALIZAÇÃO
SELECT
    id,
    slug,
    name,
    LEFT("whatsappAccessToken", 20) || '...' AS token_preview,
    LENGTH("whatsappAccessToken") AS token_length,
    "updatedAt",
    "createdAt"
FROM tenants
WHERE slug = 'hoteis-reserva';

-- 3. CONFIRMAR INTEGRAÇÃO WHATSAPP ATIVA
SELECT
    slug,
    "whatsappPhoneNumberId",
    "whatsappBusinessAccountId",
    CASE
        WHEN "whatsappAccessToken" IS NOT NULL THEN 'Token Configurado'
        ELSE 'Token Ausente'
    END AS status_token,
    "updatedAt" AS ultima_atualizacao
FROM tenants
WHERE slug = 'hoteis-reserva';

-- =====================================================
-- IMPORTANTE - LEIA COM ATENÇÃO
-- =====================================================
--
-- TOKEN TEMPORÁRIO:
-- - Este token expira em 24 horas (válido até: 2025-11-19)
-- - Para ambiente de produção, é NECESSÁRIO gerar um token permanente
--
-- COMO GERAR TOKEN PERMANENTE:
-- 1. Acesse o Meta Business Suite: https://business.facebook.com
-- 2. Vá em "Configurações" > "WhatsApp Business API"
-- 3. Selecione sua conta do WhatsApp Business
-- 4. Em "Access Tokens", clique em "Gerar Token Permanente"
-- 5. Copie o token e guarde em local seguro
-- 6. Execute este script novamente com o novo token
--
-- PRÓXIMAS ATUALIZAÇÕES:
-- - Para atualizar o token futuramente, substitua o valor na linha 12
-- - Execute todo o script para aplicar e verificar a mudança
--
-- =====================================================