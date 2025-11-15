# GitHub Actions Deploy - Documentation Index

Índice completo da documentação de deploy automático via GitHub Actions.

---

## Início Rápido

**Novo usuário? Comece aqui:**

1. [QUICKSTART.md](QUICKSTART.md) - Guia de 5 minutos para configurar deploy automático

---

## Documentação Completa

### Setup e Configuração

| Documento | Descrição | Quando Usar |
|-----------|-----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Guia rápido de 5 minutos | Primeira configuração |
| [DEPLOY-SETUP.md](DEPLOY-SETUP.md) | Guia completo passo-a-passo | Setup detalhado e referência |
| [SECRETS-EXAMPLE.md](SECRETS-EXAMPLE.md) | Configuração de GitHub Secrets | Configurar variáveis sensíveis |
| [README.md](README.md) | Visão geral da estrutura | Entender a arquitetura |

### Operação e Manutenção

| Documento | Descrição | Quando Usar |
|-----------|-----------|-------------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Solução de problemas | Quando algo falhar |
| [MAINTENANCE.md](MAINTENANCE.md) | Comandos úteis e manutenção | Operação diária |

### Arquivos Técnicos

| Arquivo | Descrição | Tipo |
|---------|-----------|------|
| [workflows/deploy-production.yml](workflows/deploy-production.yml) | Workflow de deploy | YAML |
| [scripts/setup-deploy-keys.sh](scripts/setup-deploy-keys.sh) | Script de setup SSH | Shell |

---

## Fluxo de Uso

### 1. Primeira Configuração

```
QUICKSTART.md
    ↓
[Configurar SSH Keys no VPS]
    ↓
[Configurar GitHub Secrets]
    ↓
[Testar primeiro deploy]
    ↓
DEPLOY-SETUP.md (para detalhes)
```

### 2. Operação Diária

```
[Fazer mudanças no código]
    ↓
git push origin master
    ↓
[Deploy automático]
    ↓
[Se falhar] → TROUBLESHOOTING.md
    ↓
[Se sucesso] → Monitorar via MAINTENANCE.md
```

### 3. Troubleshooting

```
[Erro ocorreu]
    ↓
TROUBLESHOOTING.md
    ↓
[Encontrar erro específico]
    ↓
[Aplicar solução]
    ↓
[Se não resolver] → DEPLOY-SETUP.md
```

---

## Por Caso de Uso

### Sou novo e quero configurar deploy automático
→ **[QUICKSTART.md](QUICKSTART.md)**

### Preciso de instruções detalhadas de setup
→ **[DEPLOY-SETUP.md](DEPLOY-SETUP.md)**

### O deploy falhou
→ **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

### Preciso configurar secrets
→ **[SECRETS-EXAMPLE.md](SECRETS-EXAMPLE.md)**

### Quero comandos úteis para o dia-a-dia
→ **[MAINTENANCE.md](MAINTENANCE.md)**

### Quero entender a estrutura do projeto
→ **[README.md](README.md)**

### Preciso modificar o workflow
→ **[workflows/deploy-production.yml](workflows/deploy-production.yml)**

---

## Checklist Geral

Use este checklist para garantir que configurou tudo:

### Setup Inicial

- [ ] Leu [QUICKSTART.md](QUICKSTART.md)
- [ ] SSH key gerada no VPS
- [ ] GitHub Secrets configurados (4 secrets)
- [ ] Diretório `/root/deploy-backend` criado
- [ ] Arquivo `.env.production` criado
- [ ] Docker rodando no VPS
- [ ] Primeiro deploy testado
- [ ] Health check retornando 200

### Pós-Setup

- [ ] Leu [TROUBLESHOOTING.md](TROUBLESHOOTING.md) (para referência)
- [ ] Marcou [MAINTENANCE.md](MAINTENANCE.md) para consulta futura
- [ ] Configurou backups automáticos
- [ ] Documentou credenciais em local seguro
- [ ] Configurou monitoramento (opcional)

### Operação Diária

- [ ] Deploy automático funcionando (push → deploy)
- [ ] Sabe onde ver logs (GitHub Actions)
- [ ] Sabe como fazer rollback (TROUBLESHOOTING.md)
- [ ] Tem comandos úteis salvos (MAINTENANCE.md)

---

## Estrutura de Pastas

```
.github/
├── workflows/
│   └── deploy-production.yml       # Workflow principal de deploy
├── scripts/
│   └── setup-deploy-keys.sh        # Helper para gerar SSH keys
├── INDEX.md                        # Este arquivo (índice)
├── QUICKSTART.md                   # Guia rápido (5 min)
├── DEPLOY-SETUP.md                 # Guia completo (detalhado)
├── SECRETS-EXAMPLE.md              # Configuração de secrets
├── TROUBLESHOOTING.md              # Solução de problemas
├── MAINTENANCE.md                  # Comandos úteis
└── README.md                       # Visão geral
```

---

## Glossário

| Termo | Significado |
|-------|-------------|
| **VPS** | Virtual Private Server (seu servidor de produção) |
| **GitHub Actions** | Serviço de CI/CD do GitHub |
| **Workflow** | Arquivo YAML que define o pipeline de deploy |
| **Secret** | Variável sensível armazenada de forma segura no GitHub |
| **SSH Key** | Chave criptográfica para autenticação SSH |
| **rsync** | Ferramenta para sincronizar arquivos via SSH |
| **Health Check** | Endpoint para verificar se aplicação está saudável |
| **Rollback** | Reverter para versão anterior |
| **Docker Compose** | Ferramenta para orquestrar múltiplos containers |

---

## Referências Externas

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [SSH Key Management](https://www.ssh.com/academy/ssh/key)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

## Versões

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0.0 | 2025-11-15 | Release inicial |

---

## Suporte

Se você não encontrar a resposta na documentação:

1. Verifique [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para erros específicos
2. Revise [DEPLOY-SETUP.md](DEPLOY-SETUP.md) para configuração completa
3. Consulte [MAINTENANCE.md](MAINTENANCE.md) para comandos úteis
4. Abra uma issue no repositório com detalhes do problema

---

## Navegação Rápida

**Por Nível de Experiência:**

- **Iniciante**: QUICKSTART.md → DEPLOY-SETUP.md
- **Intermediário**: README.md → MAINTENANCE.md
- **Avançado**: workflows/deploy-production.yml → TROUBLESHOOTING.md

**Por Objetivo:**

- **Configurar**: QUICKSTART.md
- **Entender**: README.md + DEPLOY-SETUP.md
- **Resolver**: TROUBLESHOOTING.md
- **Operar**: MAINTENANCE.md
- **Securizar**: SECRETS-EXAMPLE.md

---

**Última atualização**: 2025-11-15

**Próximos passos sugeridos**: Leia [QUICKSTART.md](QUICKSTART.md) para começar!
