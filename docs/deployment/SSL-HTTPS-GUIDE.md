# 🔐 Guia Completo SSL/HTTPS

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Opções de SSL](#opções-de-ssl)
3. [Self-Signed Certificate (Desenvolvimento)](#self-signed-certificate)
4. [Let's Encrypt (Produção)](#lets-encrypt)
5. [Configuração do Nginx](#configuração-do-nginx)
6. [Renovação de Certificados](#renovação-de-certificados)
7. [Troubleshooting](#troubleshooting)
8. [Testes e Validação](#testes-e-validação)

---

## 🎯 Visão Geral

Este guia cobre a configuração completa de SSL/HTTPS para o backend do CRM WhatsApp SaaS.

### Por que HTTPS é necessário?

1. **WhatsApp Business API** - Webhook EXIGE HTTPS
2. **Segurança** - Dados sensíveis (senhas, tokens) protegidos
3. **SEO** - Google favorece sites HTTPS
4. **Confiança** - Navegadores modernos exigem HTTPS

### Arquitetura

```
Cliente/WhatsApp
    ↓
  HTTPS (porta 443)
    ↓
Nginx (SSL Termination)
    ↓
  HTTP (porta 3001 interna)
    ↓
Backend (Node.js)
```

---

## 🔄 Opções de SSL

### Opção A: Self-Signed Certificate

**Quando usar:**
- ✅ Desenvolvimento local
- ✅ Testes internos
- ✅ Ambiente de staging
- ✅ Quando não tem domínio ainda

**Quando NÃO usar:**
- ❌ Produção
- ❌ WhatsApp Webhook (Meta não aceita)
- ❌ Qualquer ambiente público

**Características:**
- Rápido de configurar (2 minutos)
- Grátis
- Navegadores mostram aviso de segurança
- Válido por 365 dias

### Opção B: Let's Encrypt

**Quando usar:**
- ✅ Produção
- ✅ WhatsApp Webhook
- ✅ Qualquer ambiente público
- ✅ Quando tem domínio válido

**Requisitos:**
- Domínio apontando para o servidor
- Porta 80 acessível (ACME challenge)
- Porta 443 aberta

**Características:**
- Certificado VÁLIDO e confiável
- Grátis
- Renovação automática a cada 90 dias
- Aceito por todos os navegadores e APIs

---

## 🔧 Self-Signed Certificate

### Instalação

```bash
# Na VPS (/opt)
cd /opt
chmod +x scripts/setup-ssl-selfsigned.sh
./scripts/setup-ssl-selfsigned.sh
```

### Processo

1. Script solicita informações:
   - Country (BR)
   - State (Sao Paulo)
   - City (Sao Paulo)
   - Organization (CRM WhatsApp SaaS)
   - Common Name (72.61.39.235 ou localhost)

2. Gera certificado e chave privada:
   - `/opt/nginx/ssl/selfsigned.crt`
   - `/opt/nginx/ssl/selfsigned.key`

3. Atualiza configuração do Nginx automaticamente

4. Reinicia Nginx

### Verificação

```bash
# Testar HTTPS (ignorar warning SSL)
curl -k https://72.61.39.235/health

# Ver informações do certificado
openssl x509 -in /opt/nginx/ssl/selfsigned.crt -text -noout

# Verificar conexão SSL
openssl s_client -connect 72.61.39.235:443 -servername 72.61.39.235
```

### Limitações

- Navegadores mostram "Conexão não é privada"
- WhatsApp webhook NÃO funciona
- Não adequado para produção
- Precisa aceitar exceção de segurança manualmente

---

## 🌐 Let's Encrypt

### Pré-requisitos

#### 1. Registrar um Domínio

Opções gratuitas:
- [Freenom](https://www.freenom.com/) - .tk, .ml, .ga, .cf, .gq (grátis)
- [Afraid.org](https://freedns.afraid.org/) - Subdomínios grátis
- [DuckDNS](https://www.duckdns.org/) - DNS dinâmico grátis
- [No-IP](https://www.noip.com/) - DNS dinâmico grátis

Opções pagas (recomendado para produção):
- [Namecheap](https://www.namecheap.com/)
- [GoDaddy](https://www.godaddy.com/)
- [Google Domains](https://domains.google/)
- [Registro.br](https://registro.br/) - .com.br

#### 2. Configurar DNS

**Registro A:**
```
Type: A
Name: api (ou @ para root)
Value: 72.61.39.235 (IP da VPS)
TTL: 300 (5 minutos)
```

**Exemplo:**
```
api.seudominio.com → 72.61.39.235
```

#### 3. Aguardar Propagação DNS

```bash
# Verificar propagação
dig +short api.seudominio.com @8.8.8.8

# Ou online:
# https://dnschecker.org/
```

Tempo típico: 5 minutos a 48 horas

#### 4. Abrir Portas no Firewall

```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload

# Verificar
sudo ufw status
```

### Instalação

```bash
# Na VPS (/opt)
cd /opt
chmod +x scripts/setup-ssl-letsencrypt.sh
./scripts/setup-ssl-letsencrypt.sh
```

### Processo

1. **Validação de Requisitos**
   - Verifica Docker rodando
   - Verifica container certbot

2. **Entrada de Dados**
   - Domínio: api.seudominio.com
   - Email: seu@email.com

3. **Verificação DNS**
   - Confirma domínio apontando para servidor
   - Avisa se DNS não está correto

4. **ACME Challenge**
   - Certbot valida propriedade do domínio
   - Via HTTP (porta 80)
   - Let's Encrypt acessa: `http://api.seudominio.com/.well-known/acme-challenge/TOKEN`

5. **Obtenção do Certificado**
   - Certificado válido emitido
   - Armazenado em: `/opt/certbot/conf/live/api.seudominio.com/`

6. **Configuração Automática**
   - Atualiza Nginx para usar o certificado
   - Ativa redirect HTTP → HTTPS
   - Reinicia Nginx

### Arquivos Gerados

```
/opt/certbot/conf/live/api.seudominio.com/
├── fullchain.pem     # Certificado + Chain (usar no Nginx)
├── privkey.pem       # Chave privada (NUNCA compartilhar!)
├── cert.pem          # Apenas o certificado
└── chain.pem         # Intermediate certificates
```

### Verificação

```bash
# Testar HTTPS
curl https://api.seudominio.com/health

# Ver certificados instalados
docker compose -f /opt/docker-compose.production.yml run --rm certbot certificates

# Verificar conexão SSL
openssl s_client -connect api.seudominio.com:443 -servername api.seudominio.com

# Test online (SSL Labs)
# https://www.ssllabs.com/ssltest/analyze.html?d=api.seudominio.com
```

---

## ⚙️ Configuração do Nginx

### Estrutura

```
/opt/nginx/
├── nginx.conf              # Configuração principal
└── conf.d/
    └── api.conf            # Configuração do site/API
```

### Modos de Operação

#### Modo 1: HTTP apenas (Inicial)

```nginx
server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

#### Modo 2: HTTP + ACME (Durante setup Let's Encrypt)

```nginx
server {
    listen 80;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://backend;
    }
}
```

#### Modo 3: HTTPS + Redirect (Produção)

```nginx
server {
    listen 80;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;

    ssl_certificate /etc/letsencrypt/live/DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN/privkey.pem;

    # SSL config...

    location / {
        proxy_pass http://backend;
    }
}
```

### SSL Best Practices (Implementadas)

1. **Protocolos Modernos**
   ```nginx
   ssl_protocols TLSv1.2 TLSv1.3;
   ```

2. **Cipher Suites Seguras**
   ```nginx
   ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:...';
   ssl_prefer_server_ciphers off;
   ```

3. **HSTS (HTTP Strict Transport Security)**
   ```nginx
   add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
   ```

4. **OCSP Stapling**
   ```nginx
   ssl_stapling on;
   ssl_stapling_verify on;
   ```

5. **Session Cache**
   ```nginx
   ssl_session_cache shared:SSL:50m;
   ssl_session_timeout 1d;
   ```

### Testar Configuração

```bash
# Testar syntax
docker compose -f /opt/docker-compose.production.yml exec nginx nginx -t

# Recarregar sem downtime
docker compose -f /opt/docker-compose.production.yml exec nginx nginx -s reload

# Restart completo
docker compose -f /opt/docker-compose.production.yml restart nginx
```

---

## 🔄 Renovação de Certificados

### Renovação Automática (Let's Encrypt)

**Container certbot** já configurado para renovar automaticamente:

```yaml
# docker-compose.production.yml
certbot:
  image: certbot/certbot
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
```

**Como funciona:**
1. Container verifica a cada 12 horas
2. Se certificado expirar em < 30 dias, renova
3. Novos certificados salvos automaticamente
4. Nginx precisa ser recarregado (manual)

### Renovação Manual

```bash
# Forçar renovação
cd /opt
./scripts/renew-ssl.sh

# Ou via Docker direto
docker compose -f /opt/docker-compose.production.yml run --rm certbot renew --force-renewal

# Recarregar Nginx após renovação
docker compose -f /opt/docker-compose.production.yml exec nginx nginx -s reload
```

### Monitoramento

```bash
# Ver validade dos certificados
docker compose -f /opt/docker-compose.production.yml run --rm certbot certificates

# Logs do certbot
docker logs crm-certbot

# Testar renovação (dry-run)
docker compose -f /opt/docker-compose.production.yml run --rm certbot renew --dry-run
```

### Alertas de Expiração

Let's Encrypt envia emails para o endereço cadastrado:
- 30 dias antes da expiração
- 7 dias antes da expiração
- 1 dia antes da expiração

**Configure um alerta extra:**

```bash
# Cron job para verificar validade (opcional)
0 0 * * * docker compose -f /opt/docker-compose.production.yml run --rm certbot certificates | mail -s "SSL Certificates Status" seu@email.com
```

---

## 🔧 Troubleshooting

### Problema 1: ACME Challenge Falha

**Sintoma:**
```
Failed authorization procedure. api.seudominio.com (http-01):
urn:ietf:params:acme:error:connection :: The server could not connect to the client
```

**Causas:**
1. DNS não aponta para o servidor
2. Porta 80 bloqueada
3. Nginx não está rodando
4. Path `/.well-known/acme-challenge/` não acessível

**Soluções:**

```bash
# 1. Verificar DNS
dig +short api.seudominio.com @8.8.8.8
curl -I http://api.seudominio.com

# 2. Testar porta 80
telnet api.seudominio.com 80
nc -zv api.seudominio.com 80

# 3. Verificar Nginx
docker ps | grep nginx
docker logs crm-nginx

# 4. Testar ACME path
mkdir -p /opt/certbot/www/.well-known/acme-challenge
echo "test" > /opt/certbot/www/.well-known/acme-challenge/test.txt
curl http://api.seudominio.com/.well-known/acme-challenge/test.txt
rm /opt/certbot/www/.well-known/acme-challenge/test.txt
```

### Problema 2: "Too Many Failed Authorizations"

**Sintoma:**
```
Error: urn:ietf:params:acme:error:rateLimited
Too many failed authorizations recently
```

**Causa:**
Rate limit do Let's Encrypt atingido (5 falhas por hora)

**Solução:**
```bash
# Aguardar 1 hora e tentar novamente

# Enquanto isso, testar com staging
docker compose -f /opt/docker-compose.production.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email seu@email.com \
    --agree-tos \
    --staging \
    -d api.seudominio.com
```

### Problema 3: Nginx não inicia após SSL

**Sintoma:**
```
nginx: [emerg] cannot load certificate "/etc/letsencrypt/live/...": BIO_new_file() failed
```

**Causa:**
Certificado não existe ou path incorreto

**Solução:**
```bash
# Verificar se certificado existe
docker compose -f /opt/docker-compose.production.yml exec nginx ls -la /etc/letsencrypt/live/

# Verificar volumes no docker-compose
docker compose -f /opt/docker-compose.production.yml config | grep letsencrypt

# Restaurar configuração anterior
cp /opt/nginx/conf.d/api.conf.backup.TIMESTAMP /opt/nginx/conf.d/api.conf
docker compose -f /opt/docker-compose.production.yml restart nginx
```

### Problema 4: HTTPS retorna "Connection Reset"

**Causa:**
Porta 443 bloqueada no firewall

**Solução:**
```bash
# Verificar firewall
sudo ufw status
sudo ufw allow 443/tcp
sudo ufw reload

# Verificar se porta está listening
docker compose -f /opt/docker-compose.production.yml exec nginx netstat -tlnp | grep 443

# Testar de fora
telnet api.seudominio.com 443
```

### Problema 5: "Certificate has expired"

**Causa:**
Renovação automática falhou

**Solução:**
```bash
# Forçar renovação manual
./scripts/renew-ssl.sh

# Verificar logs do certbot
docker logs crm-certbot --tail 100

# Verificar se container está rodando
docker ps | grep certbot
```

---

## ✅ Testes e Validação

### 1. Teste Básico

```bash
# HTTP
curl -I http://api.seudominio.com/health

# HTTPS
curl -I https://api.seudominio.com/health

# Redirect HTTP → HTTPS
curl -I http://api.seudominio.com/health
# Deve retornar 301 Moved Permanently
# Location: https://api.seudominio.com/health
```

### 2. Teste de Certificado

```bash
# Informações do certificado
openssl s_client -connect api.seudominio.com:443 -servername api.seudominio.com </dev/null 2>/dev/null | openssl x509 -noout -dates

# Validade
echo | openssl s_client -connect api.seudominio.com:443 -servername api.seudominio.com 2>/dev/null | openssl x509 -noout -dates
```

### 3. SSL Labs Test

Teste profissional e detalhado:
```
https://www.ssllabs.com/ssltest/analyze.html?d=api.seudominio.com
```

**Objetivo:** Grade A ou A+

### 4. Teste de HSTS

```bash
curl -I https://api.seudominio.com/health | grep Strict-Transport-Security
# Deve retornar: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

### 5. Teste de Cipher Suites

```bash
nmap --script ssl-enum-ciphers -p 443 api.seudominio.com
```

### 6. Teste do WhatsApp Webhook

```bash
# Registrar webhook (substitua TOKEN)
curl -X POST "https://graph.facebook.com/v21.0/YOUR_PHONE_NUMBER_ID/webhooks" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "callback_url": "https://api.seudominio.com/webhooks/whatsapp",
    "verify_token": "SEU_VERIFY_TOKEN"
  }'
```

---

## 📊 Checklist Completo

### Pré-Deploy

- [ ] Domínio registrado
- [ ] DNS configurado (A record)
- [ ] DNS propagado (dig +short)
- [ ] Portas 80 e 443 abertas no firewall
- [ ] Docker rodando na VPS
- [ ] Nginx rodando e acessível

### Self-Signed (Desenvolvimento)

- [ ] Script executado: `./scripts/setup-ssl-selfsigned.sh`
- [ ] Certificado gerado: `/opt/nginx/ssl/selfsigned.crt`
- [ ] Nginx restart bem-sucedido
- [ ] HTTPS acessível (curl -k)
- [ ] Health check retorna 200

### Let's Encrypt (Produção)

- [ ] Script executado: `./scripts/setup-ssl-letsencrypt.sh`
- [ ] ACME challenge passou
- [ ] Certificado obtido: `/opt/certbot/conf/live/DOMAIN/`
- [ ] Nginx restart bem-sucedido
- [ ] HTTPS acessível sem -k
- [ ] HTTP redireciona para HTTPS
- [ ] SSL Labs grade A ou A+
- [ ] WhatsApp webhook registrado com sucesso

### Pós-Deploy

- [ ] Renovação automática testada (dry-run)
- [ ] Documentação atualizada com domínio real
- [ ] Variável BASE_DOMAIN atualizada em .env.production
- [ ] Frontend atualizado para usar HTTPS
- [ ] Monitoramento de expiração configurado

---

## 📚 Referências

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [Nginx SSL Guide](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [Mozilla SSL Configuration Generator](https://ssl-config.mozilla.org/)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
- [OWASP TLS Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html)

---

**Última atualização:** 12/11/2025
**Versão:** 1.0.0
**Status:** ✅ Production-Ready
