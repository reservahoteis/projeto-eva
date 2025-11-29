# 🗄️ DBeaver - Configuração de Acesso ao Banco de Dados

**Data:** 16/11/2025
**Banco:** PostgreSQL 16
**Status:** ✅ Produção

---

## 📋 Credenciais do Banco de Dados

### **Informações de Conexão**

| Campo | Valor |
|-------|-------|
| **Host** | `72.61.39.235` |
| **Porta** | `5432` |
| **Database** | `crm_whatsapp_saas` |
| **Username** | `crm_user` |
| **Password** | `CrmSecurePass2024!` |
| **Driver** | PostgreSQL |

---

## 🔧 Configuração Passo a Passo no DBeaver

### **1. Abrir DBeaver**

- Inicie o DBeaver Community Edition
- Vá em: **Database** → **New Database Connection**

### **2. Selecionar PostgreSQL**

- Na lista de bancos, selecione **PostgreSQL**
- Clique em **Next**

### **3. Configurar Conexão Principal**

Preencha os campos conforme abaixo:

**Aba Main:**

```
Host: 72.61.39.235
Port: 5432
Database: crm_whatsapp_saas
Username: crm_user
Password: CrmSecurePass2024!
```

**Marque a opção:**
- ✅ **Save password locally**

### **4. Testar Conexão**

- Clique em **Test Connection**
- DBeaver pode pedir para baixar o driver PostgreSQL
- Clique em **Download** se necessário
- Aguarde aparecer: **"Connected"**

### **5. Configurações Avançadas (Opcional)**

**Aba SSH:**
- ❌ Não é necessário (banco está diretamente exposto na porta 5432)

**Aba SSL:**
- Mode: `disable` (não necessário em VPS privada)

**Aba Advanced:**
- Deixar padrão

### **6. Finalizar**

- Clique em **Finish**
- A conexão aparecerá na lista à esquerda

---

## 🔌 Verificação de Porta (Se não conectar)

Se a conexão falhar, verifique se a porta 5432 está aberta no firewall:

```bash
# No VPS (via SSH)
ssh root@72.61.39.235

# Verificar se PostgreSQL está escutando
sudo netstat -tulpn | grep 5432

# Verificar regras de firewall (UFW)
sudo ufw status

# Se necessário, abrir porta 5432
sudo ufw allow 5432/tcp
sudo ufw reload
```

**Verificar no Docker:**
```bash
# Ver se container PostgreSQL está rodando
docker ps | grep postgres

# Ver logs do PostgreSQL
docker logs crm-postgres --tail 50
```

---

## 📊 Estrutura do Banco de Dados

### **Principais Tabelas**

```
crm_whatsapp_saas/
├── users                    # Usuários do sistema
├── tenants                  # Tenants (hotéis)
├── contacts                 # Contatos (clientes WhatsApp)
├── conversations            # Conversas WhatsApp
├── messages                 # Mensagens enviadas/recebidas
├── whatsapp_credentials     # Credenciais WhatsApp por tenant
├── tags                     # Tags para organização
└── conversation_tags        # Relação conversas <-> tags
```

### **Queries Úteis**

#### **1. Listar todos os tenants:**
```sql
SELECT id, slug, name, "whatsappPhoneNumberId", "createdAt"
FROM tenants
ORDER BY "createdAt" DESC;
```

#### **2. Listar usuários por tenant:**
```sql
SELECT
  u.id,
  u.email,
  u.name,
  u.role,
  t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u."tenantId" = t.id
ORDER BY t.name, u.email;
```

#### **3. Listar últimas mensagens:**
```sql
SELECT
  m.id,
  m.content,
  m.direction,
  m.type,
  m.status,
  m."timestamp",
  c.name as contact_name,
  t.name as tenant_name
FROM messages m
JOIN conversations conv ON m."conversationId" = conv.id
JOIN contacts c ON conv."contactId" = c.id
JOIN tenants t ON conv."tenantId" = t.id
ORDER BY m."timestamp" DESC
LIMIT 20;
```

#### **4. Contar mensagens por tenant:**
```sql
SELECT
  t.name as tenant_name,
  COUNT(m.id) as total_messages,
  COUNT(CASE WHEN m.direction = 'INBOUND' THEN 1 END) as received,
  COUNT(CASE WHEN m.direction = 'OUTBOUND' THEN 1 END) as sent
FROM messages m
JOIN conversations conv ON m."conversationId" = conv.id
JOIN tenants t ON conv."tenantId" = t.id
GROUP BY t.name
ORDER BY total_messages DESC;
```

#### **5. Ver conversas ativas:**
```sql
SELECT
  conv.id,
  c.name as contact_name,
  c."phoneNumber",
  conv.status,
  conv.priority,
  t.name as tenant_name,
  COUNT(m.id) as total_messages
FROM conversations conv
JOIN contacts c ON conv."contactId" = c.id
JOIN tenants t ON conv."tenantId" = t.id
LEFT JOIN messages m ON m."conversationId" = conv.id
WHERE conv.status != 'CLOSED'
GROUP BY conv.id, c.name, c."phoneNumber", conv.status, conv.priority, t.name
ORDER BY conv."lastMessageAt" DESC;
```

---

## 🛡️ Segurança

### **Boas Práticas:**

1. ✅ **Nunca compartilhe as credenciais** em repositórios públicos
2. ✅ **Use conexão segura** (SSH tunnel recomendado para produção)
3. ✅ **Cuidado com comandos DELETE/UPDATE** sem WHERE
4. ✅ **Faça backup antes de alterações** em produção
5. ✅ **Use transações** para múltiplas alterações

### **Criar Backup Manual:**

```bash
# Via SSH no VPS
ssh root@72.61.39.235
cd /root/deploy-backend

# Backup completo
docker exec crm-postgres pg_dump -U crm_user crm_whatsapp_saas > backup-$(date +%Y%m%d-%H%M%S).sql

# Backup só dos dados (sem estrutura)
docker exec crm-postgres pg_dump -U crm_user --data-only crm_whatsapp_saas > backup-data-$(date +%Y%m%d-%H%M%S).sql
```

---

## 🔧 Troubleshooting

### **Erro: "Connection refused"**

**Causa:** Porta 5432 não acessível ou PostgreSQL não está rodando

**Solução:**
```bash
# Verificar se PostgreSQL está rodando
docker ps | grep postgres

# Se não estiver, iniciar
docker compose -f docker-compose.production.yml up -d postgres

# Verificar logs
docker logs crm-postgres
```

---

### **Erro: "Authentication failed"**

**Causa:** Senha incorreta

**Solução:**
```bash
# Verificar senha no .env
ssh root@72.61.39.235
cd /root/deploy-backend
grep POSTGRES_PASSWORD .env
```

---

### **Erro: "Database does not exist"**

**Causa:** Banco de dados não foi criado

**Solução:**
```bash
# Criar banco manualmente
docker exec -it crm-postgres psql -U crm_user -c "CREATE DATABASE crm_whatsapp_saas;"

# Rodar migrations
docker exec crm-backend npx prisma migrate deploy
```

---

## 📞 Suporte

**Problemas de conexão?**
- Verificar se VPS está acessível: `ping 72.61.39.235`
- Verificar se porta 5432 está aberta: `telnet 72.61.39.235 5432`
- Ver logs do PostgreSQL: `docker logs crm-postgres -f`

**Documentação adicional:**
- [Prisma Schema](../deploy-backend/prisma/schema.prisma)
- [API Endpoints](./API-ENDPOINTS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)

---

## 🎯 Acesso Rápido via SQL

Se preferir acesso direto via terminal:

```bash
# SSH no VPS
ssh root@72.61.39.235

# Acessar PostgreSQL diretamente
docker exec -it crm-postgres psql -U crm_user -d crm_whatsapp_saas

# Ou via query direta
docker exec crm-postgres psql -U crm_user -d crm_whatsapp_saas -c "SELECT * FROM tenants;"
```

---

**Data de criação:** 16/11/2025
**Última atualização:** 16/11/2025
**Responsável:** Claude Code + Fred Castro

---

## ⚠️ IMPORTANTE - CREDENCIAIS SENSÍVEIS

**Este documento contém credenciais de produção. NÃO faça commit dele em repositórios públicos!**

Adicione ao `.gitignore`:
```
docs/DBEAVER-SETUP.md
```
