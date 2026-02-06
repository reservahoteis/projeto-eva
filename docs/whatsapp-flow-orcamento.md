# WhatsApp Flow - Orçamento de Reserva

## Informações do Flow

- **Tenant**: hoteis-reserva
- **Flow ID**: `1615456676252249`
- **Nome**: Orcamento de Reserva
- **Categoria**: APPOINTMENT_BOOKING
- **WABA ID**: 1377104410568104
- **Status**: Criado com sucesso em 2026-02-06

## Credenciais (Reference)

```bash
# Buscar credenciais do banco
ssh root@72.61.39.235 "docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -t -c \"SELECT slug, \\\"whatsappBusinessAccountId\\\", \\\"whatsappAccessToken\\\" FROM tenants WHERE slug='hoteis-reserva'\""

# Buscar ENCRYPTION_KEY
ssh root@72.61.39.235 "docker exec crm-backend printenv ENCRYPTION_KEY"
```

## Response da Criação

```json
{
  "id": "1615456676252249",
  "success": true,
  "validation_errors": []
}
```

## Próximos Passos

### 1. Upload do JSON do Flow
```bash
curl --ssl-no-revoke -X POST \
  "https://graph.facebook.com/v21.0/1615456676252249/assets" \
  -H "Authorization: Bearer {ACCESS_TOKEN}" \
  -F "name=flow.json" \
  -F "asset_type=FLOW_JSON" \
  -F "file=@flow-orcamento.json"
```

### 2. Estrutura do JSON do Flow
O arquivo `flow-orcamento.json` deve conter:
- Telas de captura de dados (nome, email, telefone, datas)
- Validações de formulário
- Integração com endpoint de webhook
- Tela de confirmação

### 3. Publicar o Flow
```bash
curl --ssl-no-revoke -X POST \
  "https://graph.facebook.com/v21.0/1615456676252249/publish" \
  -H "Authorization: Bearer {ACCESS_TOKEN}"
```

## Integração com Backend

### Webhook Endpoint
- **URL**: `https://crm.hoteisreserva.com.br/api/v1/webhooks/whatsapp/flow`
- **Method**: POST
- **Headers**:
  - `x-whatsapp-signature`: Validação de autenticidade

### Payload Esperado
```json
{
  "flow_token": "unique_token",
  "data": {
    "nome": "João Silva",
    "email": "joao@example.com",
    "telefone": "+5511999999999",
    "dataCheckin": "2026-03-15",
    "dataCheckout": "2026-03-20",
    "numeroAdultos": 2,
    "numeroCriancas": 0
  }
}
```

## Script de Descriptografia

Para descriptografar tokens do banco:

```bash
node deploy-backend/scripts/decrypt-token.js
```

## Referências

- [WhatsApp Flows API](https://developers.facebook.com/docs/whatsapp/flows)
- [Flow JSON Schema](https://developers.facebook.com/docs/whatsapp/flows/reference/flowjson)
