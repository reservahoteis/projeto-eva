-- Atualizar WhatsApp Access Token
-- Tenant ID: 916ca70a-0428-47f8-98a3-0f791e42f292

UPDATE tenants
SET "whatsappAccessToken" = 'EAAhLVq96CJ8BP3hKDX6p9yZB3wCl1ZAIZAI2zumZAkEQvCdfWk4tFZAeSZA4KQDstAwt4v1KrAzXq7UmDPAZB3kZCkCs3xElFZAUGnUI0G6UwzHI0n2jhHEZC3LeniPeWdVj1aShtHh1naRDZAFA4Ic2sdpjkg2ko4y6zdoIqdPbrMfARGhiaS4lZB5BSLbNAH7Rtga25CuqARXtVrb84gRTL4giOHP8QCu0fxUuuTK9ZA7B2xigmdc0wLpbrZARb75QEu2okjzfnnIvRoiLgqAPZC3ZBQBjuyY724DZCcr12SZAt1jQZDZD',
    "updatedAt" = NOW()
WHERE id = '916ca70a-0428-47f8-98a3-0f791e42f292';

-- Verificar atualização
SELECT
  id,
  name,
  slug,
  "whatsappPhoneNumberId",
  LEFT("whatsappAccessToken", 50) || '...' as token_preview,
  "updatedAt"
FROM tenants
WHERE id = '916ca70a-0428-47f8-98a3-0f791e42f292';
