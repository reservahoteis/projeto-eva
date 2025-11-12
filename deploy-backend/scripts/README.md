# 📜 Scripts de Deploy e Manutenção

## 📁 Scripts Disponíveis

| Script | Descrição | Quando Usar |
|--------|-----------|-------------|
| `setup-ssl-selfsigned.sh` | Configura SSL com certificado auto-assinado | Desenvolvimento/Testes |
| `setup-ssl-letsencrypt.sh` | Configura SSL com Let's Encrypt | Produção com domínio |
| `renew-ssl.sh` | Renova certificados SSL manualmente | Quando renovação automática falhar |
| `deploy.sh` | Deploy completo da aplicação | Deploy inicial ou updates |
| `backup.sh` | Backup do banco de dados | Daily backups |
| `restore.sh` | Restaura backup do banco de dados | Recuperação de desastres |

---

## 🔐 SSL/HTTPS

### setup-ssl-selfsigned.sh

**Propósito:** Criar certificado SSL auto-assinado para desenvolvimento/testes

**Quando usar:**
- ✅ Desenvolvimento local na VPS
- ✅ Testes antes de ter domínio
- ✅ Ambiente de staging
- ❌ NÃO usar em produção
- ❌ NÃO funciona com WhatsApp webhook

**Como usar:**
```bash
cd /opt
chmod +x scripts/setup-ssl-selfsigned.sh
./scripts/setup-ssl-selfsigned.sh
```

**O que faz:**
1. Solicita informações do certificado (país, estado, cidade, etc.)
2. Gera chave privada RSA 2048 bits
3. Gera certificado auto-assinado válido por 365 dias
4. Atualiza configuração do Nginx automaticamente
5. Monta volume SSL no docker-compose
6. Reinicia Nginx
7. Testa HTTPS

**Saídas:**
- `/opt/nginx/ssl/selfsigned.crt` - Certificado
- `/opt/nginx/ssl/selfsigned.key` - Chave privada (600)
- `/opt/nginx/conf.d/api.conf.backup.TIMESTAMP` - Backup

**Validação:**
```bash
# Testar HTTPS (ignorar aviso SSL)
curl -k https://72.61.39.235/health

# Ver info do certificado
openssl x509 -in /opt/nginx/ssl/selfsigned.crt -text -noout
```

---

### setup-ssl-letsencrypt.sh

**Propósito:** Obter certificado SSL VÁLIDO via Let's Encrypt para produção

**Quando usar:**
- ✅ Produção
- ✅ WhatsApp webhook (HTTPS obrigatório)
- ✅ Ambiente público
- ⚠️ Requer domínio apontando para o servidor

**Pré-requisitos:**
1. Domínio registrado e configurado
2. DNS A record: `api.seudominio.com` → `72.61.39.235`
3. DNS propagado (aguardar até 48h após configuração)
4. Portas 80 e 443 abertas no firewall
5. Docker rodando

**Como usar:**
```bash
cd /opt
chmod +x scripts/setup-ssl-letsencrypt.sh
./scripts/setup-ssl-letsencrypt.sh
```

**O que faz:**
1. Valida requisitos (Docker, certbot, portas)
2. Solicita domínio e email
3. Verifica DNS (dig)
4. Configura ACME challenge no Nginx
5. Solicita certificado ao Let's Encrypt
6. Valida domínio via HTTP-01 challenge
7. Obtém certificado válido por 90 dias
8. Atualiza Nginx para usar o certificado
9. Ativa redirect HTTP → HTTPS
10. Reinicia Nginx
11. Testa HTTPS
12. Testa renovação (dry-run)

**Saídas:**
- `/opt/certbot/conf/live/DOMAIN/fullchain.pem` - Certificado completo
- `/opt/certbot/conf/live/DOMAIN/privkey.pem` - Chave privada
- `/opt/certbot/conf/live/DOMAIN/cert.pem` - Certificado apenas
- `/opt/certbot/conf/live/DOMAIN/chain.pem` - Intermediate certs
- `/opt/nginx/conf.d/api.conf.backup.TIMESTAMP` - Backup

**Validação:**
```bash
# Testar HTTPS
curl https://api.seudominio.com/health

# Ver certificados instalados
docker compose -f /opt/docker-compose.production.yml run --rm certbot certificates

# SSL Labs Test (Grade A esperada)
# https://www.ssllabs.com/ssltest/analyze.html?d=api.seudominio.com
```

**Troubleshooting:**

**Erro: "DNS não aponta para este servidor"**
```bash
# Verificar propagação DNS
dig +short api.seudominio.com @8.8.8.8

# Deve retornar o IP da VPS (72.61.39.235)
# Se não retornar, aguardar propagação ou corrigir DNS
```

**Erro: "Failed authorization procedure"**
```bash
# Verificar ACME challenge acessível
echo "test" > /opt/certbot/www/.well-known/acme-challenge/test.txt
curl http://api.seudominio.com/.well-known/acme-challenge/test.txt
# Deve retornar "test"

# Verificar porta 80
telnet api.seudominio.com 80
```

**Erro: "Too many failed authorizations"**
- Rate limit do Let's Encrypt (5 falhas/hora)
- Aguardar 1 hora e tentar novamente
- Usar staging para testes: adicionar flag `--staging` no certbot

---

### renew-ssl.sh

**Propósito:** Renovar certificados SSL manualmente

**Quando usar:**
- Certificado próximo da expiração (< 30 dias)
- Renovação automática falhou
- Após mudanças no domínio

**Como usar:**
```bash
cd /opt
./scripts/renew-ssl.sh
```

**O que faz:**
1. Lista certificados instalados
2. Força renovação de TODOS os certificados
3. Recarrega Nginx

**Notas:**
- Renovação automática já está configurada (container certbot)
- Container verifica a cada 12 horas
- Renova automaticamente se < 30 dias para expirar
- Use este script apenas em casos excepcionais

**Validação:**
```bash
# Ver validade dos certificados
docker compose -f /opt/docker-compose.production.yml run --rm certbot certificates

# Testar renovação (não renova de verdade)
docker compose -f /opt/docker-compose.production.yml run --rm certbot renew --dry-run
```

---

## 🚀 Deploy

### deploy.sh

**Propósito:** Deploy completo da aplicação

**Como usar:**
```bash
cd /opt
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

**O que faz:**
1. Pull do código (Git)
2. Instala/atualiza dependências (npm)
3. Build TypeScript
4. Executa migrations (Prisma)
5. Rebuild container backend
6. Restart containers
7. Verifica health checks

---

## 💾 Backup & Restore

### backup.sh

**Propósito:** Backup completo do banco de dados PostgreSQL

**Como usar:**
```bash
cd /opt
./scripts/backup.sh
```

**O que faz:**
1. Cria dump do PostgreSQL
2. Comprime com gzip
3. Salva em `/opt/backups/`
4. Remove backups antigos (> 7 dias)

**Saída:**
```
/opt/backups/backup_YYYYMMDD_HHMMSS.sql.gz
```

**Automatizar (cron):**
```bash
# Backup diário às 3h
0 3 * * * cd /opt && ./scripts/backup.sh
```

---

### restore.sh

**Propósito:** Restaurar backup do banco de dados

**Como usar:**
```bash
cd /opt
./scripts/restore.sh /opt/backups/backup_20251112_030000.sql.gz
```

**⚠️ CUIDADO:**
- Sobrescreve TODOS os dados do banco
- Faça backup antes de restaurar
- Use apenas em recuperação de desastres

---

## 📚 Documentação Completa

Para guias detalhados, consulte:

- **SSL/HTTPS:** `/opt/docs/SSL-HTTPS-GUIDE.md`
- **Deploy:** `/opt/docs/GUIA-DEPLOY.md` (se existir)
- **Troubleshooting:** `/opt/DOCUMENTACAO-COMPLETA.md`

---

## 🔒 Permissões

Todos os scripts devem ter permissão de execução:

```bash
chmod +x scripts/*.sh
```

**Permissões recomendadas:**
- Scripts: `755` (rwxr-xr-x)
- Certificados (.crt): `644` (rw-r--r--)
- Chaves privadas (.key): `600` (rw-------)

---

## ✅ Checklist de Scripts

### Após Deploy Inicial

- [ ] `deploy.sh` executado com sucesso
- [ ] `backup.sh` testado e funcionando
- [ ] Cron job de backup configurado
- [ ] `restore.sh` testado em ambiente de staging

### Configuração SSL

**Opção A: Self-Signed (Dev/Staging)**
- [ ] `setup-ssl-selfsigned.sh` executado
- [ ] HTTPS acessível (curl -k)
- [ ] Health check retorna 200

**Opção B: Let's Encrypt (Produção)**
- [ ] Domínio configurado e DNS propagado
- [ ] Portas 80 e 443 abertas
- [ ] `setup-ssl-letsencrypt.sh` executado com sucesso
- [ ] Certificado obtido
- [ ] HTTPS acessível sem warnings
- [ ] HTTP redireciona para HTTPS
- [ ] SSL Labs grade A/A+
- [ ] Renovação automática testada (dry-run)

### Manutenção Regular

- [ ] Backups diários rodando (verificar `/opt/backups/`)
- [ ] Certificados SSL válidos (verificar validade)
- [ ] Logs sem erros críticos
- [ ] Health checks passando

---

## 🆘 Suporte

Em caso de problemas:

1. **Verificar logs:**
   ```bash
   docker logs crm-backend --tail 100
   docker logs crm-nginx --tail 100
   docker logs crm-certbot --tail 100
   ```

2. **Consultar documentação:**
   - `/opt/docs/SSL-HTTPS-GUIDE.md`
   - `/opt/DOCUMENTACAO-COMPLETA.md`

3. **Restaurar backup de configuração:**
   ```bash
   # Nginx
   cp /opt/nginx/conf.d/api.conf.backup.TIMESTAMP /opt/nginx/conf.d/api.conf
   docker compose -f /opt/docker-compose.production.yml restart nginx
   ```

---

**Última atualização:** 12/11/2025
**Versão:** 1.0.0
