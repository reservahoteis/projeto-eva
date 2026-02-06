# Migration: Add bookingQuoteFlowId to Tenant

## Objetivo

Adicionar campo para armazenar o ID do WhatsApp Flow de orçamento de reserva no modelo Tenant.

## Schema Change

Adicionar ao modelo `Tenant` no arquivo `prisma/schema.prisma`:

```prisma
model Tenant {
  // ... campos existentes ...

  // WhatsApp Config (cada tenant tem suas credenciais)
  whatsappPhoneNumberId      String?
  whatsappAccessToken        String? // Criptografado em produção
  whatsappBusinessAccountId  String?
  whatsappWebhookVerifyToken String?
  whatsappAppSecret          String? // Para validar webhooks

  // WhatsApp Flows IDs (armazenar IDs dos flows publicados)
  bookingQuoteFlowId         String? // ID do flow de orçamento de reserva

  // ... restante dos campos ...
}
```

## SQL Migration

### PostgreSQL

```sql
-- Add bookingQuoteFlowId column to tenants table
ALTER TABLE "tenants"
ADD COLUMN "bookingQuoteFlowId" TEXT;

-- Add comment
COMMENT ON COLUMN "tenants"."bookingQuoteFlowId" IS 'WhatsApp Flow ID for booking quote form';

-- Optional: Create index if needed for lookups
-- CREATE INDEX "tenants_bookingQuoteFlowId_idx" ON "tenants"("bookingQuoteFlowId");
```

## Rollback

```sql
-- Remove bookingQuoteFlowId column
ALTER TABLE "tenants"
DROP COLUMN "bookingQuoteFlowId";
```

## Como Aplicar

### Opção 1: Prisma Migrate (Recomendado)

```bash
# 1. Adicionar campo ao schema.prisma
# 2. Criar migration
cd deploy-backend
npx prisma migrate dev --name add_booking_quote_flow_id

# 3. Aplicar em produção
npx prisma migrate deploy
```

### Opção 2: SQL Direto

```bash
# Development
psql -h localhost -U postgres -d crm_development -f migration.sql

# Production
psql -h <host> -U <user> -d <database> -f migration.sql
```

## Verificação

Após aplicar a migration, verificar:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tenants'
  AND column_name = 'bookingQuoteFlowId';

-- Should return:
-- column_name         | data_type | is_nullable
-- bookingQuoteFlowId  | text      | YES
```

## Uso no Código

Após a migration, o campo estará disponível:

```typescript
// Salvar flow ID após setup
await prisma.tenant.update({
  where: { id: tenantId },
  data: { bookingQuoteFlowId: flowId }
});

// Recuperar flow ID
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  select: { bookingQuoteFlowId: true }
});

if (tenant?.bookingQuoteFlowId) {
  // Enviar flow para contato
  await whatsAppFlowsService.sendFlow(
    tenantId,
    phoneNumber,
    tenant.bookingQuoteFlowId,
    flowToken,
    ctaText
  );
}
```

## Impacto

- **Breaking Change**: Não
- **Requires Downtime**: Não
- **Data Loss Risk**: Baixo (apenas adicionando campo nullable)
- **Rollback Risk**: Baixo (pode remover campo sem impacto)

## Checklist

- [ ] Adicionar campo ao `schema.prisma`
- [ ] Criar migration com `prisma migrate dev`
- [ ] Testar localmente
- [ ] Aplicar em staging: `prisma migrate deploy`
- [ ] Testar em staging
- [ ] Aplicar em production: `prisma migrate deploy`
- [ ] Atualizar documentação
- [ ] Notificar equipe

## Próximas Migrações Relacionadas

Considerar adicionar no futuro:

1. **Tabela flowSessions**: Para rastrear envios de flows
   ```prisma
   model FlowSession {
     id           String   @id @default(uuid())
     tenantId     String
     contactId    String
     flowId       String
     flowToken    String   @unique
     flowType     String   // 'BOOKING_QUOTE', 'GUEST_REGISTRATION', etc
     status       String   // 'SENT', 'COMPLETED', 'FAILED'
     sentAt       DateTime
     completedAt  DateTime?
     responseData Json?

     tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
     contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
   }
   ```

2. **Tabela bookingQuoteRequests**: Para armazenar solicitações de orçamento
   ```prisma
   model BookingQuoteRequest {
     id           String   @id @default(uuid())
     tenantId     String
     contactId    String
     checkInDate  DateTime
     checkOutDate DateTime
     nights       Int
     numGuests    Int
     hasChildren  Boolean
     childrenAges Int[]
     status       String   // 'PENDING', 'QUOTED', 'BOOKED', 'CANCELLED'
     source       String   // 'WHATSAPP_FLOW', 'MANUAL', 'WEBSITE'
     createdAt    DateTime @default(now())

     tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
     contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)
   }
   ```

## Referências

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Project Schema](../../deploy-backend/prisma/schema.prisma)
