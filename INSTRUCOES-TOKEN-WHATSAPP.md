# Instruções para Atualização do Access Token do WhatsApp

## Status da Atualização
- **Data:** 18/11/2025
- **Tenant:** hoteis-reserva
- **Tipo de Token:** Temporário (24 horas)
- **Validade:** Até 19/11/2025
- **Arquivo SQL:** `update-access-token.sql`

## Como Executar no DBeaver

### Passo a Passo:
1. **Abra o DBeaver** e conecte-se ao banco de dados PostgreSQL

2. **Abra o arquivo SQL:**
   - Arquivo > Abrir Arquivo
   - Navegue até: `C:\Users\55489\Desktop\projeto-hoteis-reserva\update-access-token.sql`

3. **Execute o script:**
   - Selecione todo o conteúdo (Ctrl+A)
   - Execute (Ctrl+Enter ou clique no botão Execute)

4. **Verifique os resultados:**
   - A primeira query atualiza o token
   - A segunda query mostra uma prévia do token atualizado
   - A terceira query confirma o status da integração

### Resultado Esperado:
```
1 row(s) updated - Token atualizado com sucesso
2 queries de verificação mostrando:
- Token preview: EAAhLVq96CJ8BP8ZA1...
- Token length: 298 caracteres
- Status: Token Configurado
```

## URGENTE: Gerar Token Permanente

### Por que é importante?
- O token atual **EXPIRA EM 24 HORAS**
- Tokens temporários são apenas para testes
- Para produção, você precisa de um token permanente

### Como Gerar Token Permanente:

1. **Acesse o Meta Business Suite**
   - URL: https://business.facebook.com
   - Faça login com sua conta de administrador

2. **Navegue até WhatsApp Business API**
   - Menu lateral: "Configurações" > "WhatsApp Business API"
   - Ou acesse direto: https://business.facebook.com/settings/whatsapp-business-accounts

3. **Selecione sua conta do WhatsApp Business**
   - Encontre a conta vinculada ao número do hotel

4. **Gere o Token Permanente**
   - Procure a seção "Access Tokens" ou "Tokens de Acesso"
   - Clique em "Generate Permanent Token" ou "Gerar Token Permanente"
   - Selecione as permissões necessárias:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`

5. **Copie e Guarde o Token**
   - IMPORTANTE: Este token só será mostrado uma vez
   - Copie imediatamente
   - Guarde em um gerenciador de senhas seguro

6. **Atualize no Sistema**
   - Edite o arquivo `update-access-token.sql`
   - Substitua o token na linha 12
   - Execute novamente no DBeaver

## Verificação da Integração

### Teste rápido via API:
```bash
curl -X GET \
  "https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Verificar no banco de dados:
```sql
-- Verificar configuração completa
SELECT
    slug,
    "whatsappPhoneNumberId",
    "whatsappBusinessAccountId",
    LEFT("whatsappAccessToken", 30) AS token_preview,
    "updatedAt"
FROM tenants
WHERE slug = 'hoteis-reserva';
```

## Checklist de Segurança

- [ ] Token atualizado no banco de dados
- [ ] Token permanente solicitado no Meta Business
- [ ] Token armazenado de forma segura
- [ ] Variáveis de ambiente configuradas (se aplicável)
- [ ] Teste de envio de mensagem funcionando
- [ ] Webhook configurado e recebendo mensagens

## Troubleshooting

### Token não funciona?
1. Verifique se o token foi copiado completamente
2. Confirme que a conta do WhatsApp está ativa
3. Verifique as permissões do token no Meta Business

### Erro 401 - Unauthorized?
- Token expirado ou inválido
- Gere um novo token seguindo as instruções acima

### Mensagens não chegam?
1. Verifique o `whatsappPhoneNumberId` no banco
2. Confirme que o webhook está configurado
3. Teste com o WhatsApp Business API Test Tool

## Contato e Suporte

Para problemas com a integração WhatsApp:
- Documentação Meta: https://developers.facebook.com/docs/whatsapp
- Status da API: https://developers.facebook.com/status/

## Histórico de Atualizações

| Data | Tipo | Validade | Responsável |
|------|------|----------|-------------|
| 18/11/2025 | Token Temporário | 24 horas | Sistema |
| (Pendente) | Token Permanente | Sem expiração | Usuário |

---

**LEMBRETE:** Este token expira em 19/11/2025. Gere o token permanente o quanto antes!