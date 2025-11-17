-- Atualizar tenant Hoteis Reserva com credenciais de TESTE da Meta
-- Data: 17/11/2025
-- Número de teste: +1 555 639 8497

UPDATE tenants
SET
  "whatsappPhoneNumberId" = '796628440207853',
  "whatsappBusinessAccountId" = '1350650163185836',
  "whatsappAccessToken" = 'EAAhLVq96CJ8BP38MrFZCNyrHhSjOTuZC3RmVtOr9jZC4FtA879NJHWLoqnTcpXHmycTSLyZCzUzZAatLBnblKOqQoaOZBhnPpdbe5JO0ST1TZANxr5mcqZCE2odZBZCEGN7CKXhiUjZC0k2xysMES0y1ilLQTgpAb8P1txjAddL53SQIPIfrm0IAXumEGZBaIwpWCUH8ZCApD5y8UWNTIZBvBNLkLZBnvdt10rXWC3BUuznfUXV8eOiYcRPGfRgF5ctnobRngZDZD',
  "updatedAt" = NOW()
WHERE slug = 'hoteis-reserva';

-- Verificar atualização
SELECT
  slug,
  name,
  "whatsappPhoneNumberId",
  "whatsappBusinessAccountId",
  "whatsappAccessToken" IS NOT NULL as has_token,
  "whatsappAppSecret" IS NOT NULL as has_secret,
  "whatsappWebhookVerifyToken" IS NOT NULL as has_verify_token
FROM tenants
WHERE slug = 'hoteis-reserva';
