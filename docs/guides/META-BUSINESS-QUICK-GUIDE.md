# Meta Business Manager - Guia Rápido de Configuração

## ETAPA 1: Deploy da Privacy Policy

### Verificar se o arquivo está pronto
```bash
ls -la apps/frontend/src/app/privacy-policy/page.tsx
# Deve mostrar: 730 linhas, 32KB
```

### Fazer deploy
```bash
cd apps/frontend
npm run build
npm run deploy
```

### Testar URL
```
https://www.botreserva.com.br/privacy-policy
```

**Checklist:**
- [ ] Página carrega sem erros
- [ ] HTTPS funcionando (cadeado verde)
- [ ] Design responsivo OK
- [ ] Todas as seções visíveis

---

## ETAPA 2: Acessar Meta Business Manager

### Passo 1: Login
1. Acesse: https://business.facebook.com
2. Faça login com sua conta Meta/Facebook
3. Selecione a conta comercial **Bot Reserva**

### Passo 2: Acessar WhatsApp Manager
1. No menu lateral, clique em **WhatsApp Manager**
   - Ou acesse direto: https://business.facebook.com/wa/manage/home/
2. Selecione o número de telefone do WhatsApp Business

---

## ETAPA 3: Adicionar Privacy Policy

### Opção A: Configurações da Conta WhatsApp

```
WhatsApp Manager > [Seu Número] > Configurações > Privacy Policy
```

**Campos:**
- **Privacy Policy URL:** `https://www.botreserva.com.br/privacy-policy`
- **Salvar**

### Opção B: Perfil da Empresa (Business Profile)

```
WhatsApp Manager > Business Profile > Editar
```

**Campos obrigatórios:**
- **Nome da empresa:** `Bot Reserva`
- **Categoria:** `Tecnologia/Software` ou `Serviços de Reserva`
- **Descrição:** `Sistema CRM WhatsApp para hotéis`
- **Site:** `https://www.botreserva.com.br`
- **E-mail:** `contato@botreserva.com.br`
- **Privacy Policy:** `https://www.botreserva.com.br/privacy-policy`

**Salvar perfil**

---

## ETAPA 4: Configurar App do Facebook (se aplicável)

### Se você tem um App do Facebook:

1. Acesse: https://developers.facebook.com
2. Selecione seu App
3. Vá para: **Settings > Basic**
4. Adicione:
   - **Privacy Policy URL:** `https://www.botreserva.com.br/privacy-policy`
   - **Terms of Service URL (opcional):** `https://www.botreserva.com.br/terms`
5. **Save Changes**

---

## ETAPA 5: Validação

### Teste o link no perfil
1. Abra o WhatsApp Business
2. Visualize o perfil da empresa
3. Clique no link da Privacy Policy
4. Confirme que abre corretamente

### Aguarde aprovação do Meta
- **Tempo:** 24-48 horas
- **E-mail:** Você receberá notificação
- **Status:** Aparecerá como "Approved" ou "Aprovado"

---

## CAMPOS ESPECÍFICOS

### Dados que o Meta valida:

| Requisito | Nossa Política | Seção |
|-----------|----------------|-------|
| Dados coletados | Sim | 2 |
| Finalidades de uso | Sim | 3 |
| Compartilhamento | Sim | 5 |
| Direitos do usuário | Sim | 6 |
| Informações de contato | Sim | 14 |
| Referência ao WhatsApp | Sim | 5.1, 9 |
| Base legal (LGPD) | Sim | 12 |
| DPO | Sim | 11 |

---

## RESOLUÇÃO DE PROBLEMAS

### Erro: "URL não acessível"
**Solução:**
1. Verifique se o deploy foi feito
2. Teste a URL em modo anônimo
3. Confirme HTTPS (SSL válido)
4. Aguarde propagação DNS (até 24h)

### Erro: "Conteúdo insuficiente"
**Solução:**
- Nossa política já está completa com todas as seções
- Verifique se o CSS está carregando
- Confirme que todas as seções são visíveis

### Erro: "URL inválida"
**Solução:**
- Use HTTPS (não HTTP)
- Não use localhost ou IPs
- Remova parâmetros (?param=value)
- Use domínio verificado

### Rejeição após revisão
**Ações:**
1. Leia o e-mail de rejeição do Meta
2. Identifique qual seção está faltando
3. Adicione o conteúdo (se necessário)
4. Reenvie para revisão
5. Aguarde nova validação (24-48h)

---

## CHECKLIST FINAL

### Antes de submeter ao Meta:

#### Deploy
- [ ] Build executado sem erros
- [ ] Deploy realizado com sucesso
- [ ] URL acessível publicamente
- [ ] HTTPS funcionando corretamente
- [ ] Certificado SSL válido

#### Conteúdo
- [ ] Todas as 15 seções visíveis
- [ ] Links externos funcionando
- [ ] E-mail correto (contato@botreserva.com.br)
- [ ] Data de atualização correta (17/11/2025)
- [ ] Empresa: Bot Reserva
- [ ] Website: www.botreserva.com.br

#### Design
- [ ] Responsivo testado (mobile + desktop)
- [ ] Tipografia legível
- [ ] Cores adequadas
- [ ] Sem erros no console
- [ ] Layout não quebrado

#### Meta Business Manager
- [ ] URL adicionada no WhatsApp Manager
- [ ] Perfil da empresa atualizado
- [ ] App do Facebook configurado (se aplicável)
- [ ] Categoria correta selecionada
- [ ] Informações de contato completas

---

## INFORMAÇÕES PARA O META

### Quando solicitado, use:

**Nome da empresa:**
```
Bot Reserva
```

**Descrição curta:**
```
Sistema CRM WhatsApp para hotéis
```

**Descrição completa:**
```
Bot Reserva é um sistema de CRM via WhatsApp Business API
que permite hotéis gerenciarem reservas e atendimento ao
cliente de forma automatizada e personalizada.
```

**Categoria principal:**
```
Tecnologia/Software
```

**Categoria secundária (opcional):**
```
Serviços de Reserva
```

**Website:**
```
https://www.botreserva.com.br
```

**E-mail de contato:**
```
contato@botreserva.com.br
```

**Privacy Policy URL:**
```
https://www.botreserva.com.br/privacy-policy
```

**Horário de atendimento:**
```
Segunda a sexta, 9h às 18h (Brasília)
```

---

## URLS IMPORTANTES

### Meta/Facebook
- **Meta Business Manager:** https://business.facebook.com
- **WhatsApp Manager:** https://business.facebook.com/wa/manage/home/
- **Meta for Developers:** https://developers.facebook.com
- **Help Center:** https://www.facebook.com/business/help

### WhatsApp
- **WhatsApp Business API Docs:** https://developers.facebook.com/docs/whatsapp
- **Privacy Policy Requirements:** https://developers.facebook.com/docs/whatsapp/overview/privacy
- **WhatsApp Privacy:** https://www.whatsapp.com/legal/privacy-policy
- **WhatsApp Business Terms:** https://www.whatsapp.com/legal/business-terms

### LGPD/Brasil
- **LGPD (Lei 13.709/2018):** http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- **ANPD:** https://www.gov.br/anpd

---

## LINHA DO TEMPO

```
DIA 1 (Hoje)
├─ [x] Privacy Policy criada
├─ [ ] Deploy realizado
└─ [ ] URL testada

DIA 2
├─ [ ] URL adicionada no Meta Business Manager
├─ [ ] Perfil da empresa atualizado
└─ [ ] App Facebook configurado (se aplicável)

DIAS 3-4
├─ [ ] Aguardar validação do Meta
└─ [ ] Verificar e-mails

DIA 5
└─ [ ] Confirmação de aprovação
```

---

## TEMPLATE DE E-MAIL PARA O META (se necessário)

```
Assunto: Privacy Policy - Bot Reserva WhatsApp Business

Olá, equipe de suporte do Meta Business,

Adicionamos a Privacy Policy do Bot Reserva conforme os
requisitos do WhatsApp Business API.

Informações:
- Empresa: Bot Reserva
- WhatsApp Number: [SEU NÚMERO]
- Privacy Policy URL: https://www.botreserva.com.br/privacy-policy
- Business Manager ID: [SEU ID]

A política de privacidade inclui:
✓ Dados coletados via WhatsApp
✓ Finalidades de uso
✓ Compartilhamento com Meta/WhatsApp
✓ Direitos do usuário (LGPD)
✓ Informações de contato
✓ Base legal para tratamento

A política está em conformidade com:
✓ LGPD (Lei 13.709/2018)
✓ WhatsApp Business API requirements
✓ Meta privacy guidelines

Aguardamos a validação.

Atenciosamente,
Equipe Bot Reserva
contato@botreserva.com.br
```

---

## PRÓXIMOS PASSOS APÓS APROVAÇÃO

### 1. Monitoramento
- Verificar analytics da página
- Acompanhar feedback de usuários
- Monitorar reclamações/solicitações

### 2. Manutenção
- Revisar anualmente (mínimo)
- Atualizar quando houver novos recursos
- Responder solicitações LGPD em até 15 dias

### 3. Comunicação
- Notificar usuários sobre alterações
- Manter cópia atualizada no Meta
- Documentar todas as versões

---

## CONTATO DE SUPORTE

### Bot Reserva
- **E-mail:** contato@botreserva.com.br
- **Website:** https://www.botreserva.com.br
- **DPO:** contato@botreserva.com.br (assunto: "DPO - Proteção de Dados")

### Meta/WhatsApp Support
- **WhatsApp Business Support:** https://business.facebook.com/wa/manage/support/
- **Meta Business Help Center:** https://www.facebook.com/business/help
- **Developer Support:** https://developers.facebook.com/support/

---

**Documento criado em:** 17/11/2025
**Última atualização:** 17/11/2025
**Versão:** 1.0
**Status:** Pronto para uso

---

## RESUMO EXECUTIVO

### O que foi criado:
- Privacy Policy completa (730 linhas, 32KB)
- LGPD compliant
- Meta/WhatsApp compliant
- Next.js 14 + TypeScript + Tailwind CSS

### O que fazer agora:
1. Deploy da página
2. Adicionar URL no Meta Business Manager
3. Aguardar aprovação (24-48h)

### URL final:
```
https://www.botreserva.com.br/privacy-policy
```

**Status:** Pronto para produção
